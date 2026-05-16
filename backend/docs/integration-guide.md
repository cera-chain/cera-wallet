# CERA Wallet Integration Guide

This guide explains how to connect a wallet to a CERA node: environment setup, connectivity checks, and basic call examples.

## 1. Environment setup

### 1.1 Node requirements

- A machine running a full CERA node must be reachable (local or remote).
- RPC must be running; default port **8545**.
- For remote nodes, ensure firewall/security groups allow that port.

### 1.2 Endpoint configuration

| Environment | Example endpoint |
|------|----------|
| Local dev | `http://127.0.0.1:8545` |
| LAN | `http://192.168.x.x:8545` |
| Public (example) | `http://node.example.org:8545` |

The wallet should support configurable RPC endpoints for mainnet/testnet or self-hosted nodes.

## 2. Minimal call flow (recommended)

**Shortest path** from zero to a trackable transaction (same for Bot / Web / App):

1. **`get_wallet_summary`** (`params.address`) — read **`next_nonce`** and **`available`**; do not compute locally.
2. **Build transaction** — `from` / `to` / `value` (or `amount`) / `fee` / **`nonce` = `next_nonce` from step 1**.
3. **Sign locally** (if required by the protocol) — private keys stay in a secure environment.
4. **`send_transaction`** — parse **`result.success`**; if `false`, branch on **`result.error`** (only `ERR_NONCE_TOO_LOW` / `ERR_NONCE_TOO_HIGH` may retry after refreshing summary), see [api-reference.md](./api-reference.md).
5. **Poll status** — try **`get_transaction_receipt`** first; on `receipt not found`, fall back to **`get_transaction`** until included or timeout.

Details and failure paths: [transaction-flow.md](./transaction-flow.md).

## 2.1 Address format

- User-visible wallet addresses use `cera1...` Bech32m.
- Integrators should prefer `cera1...` in `get_wallet_summary`, `get_balance`, `get_nonce`, `send_transaction`, and staking fields.
- Legacy `0x` + 32-byte account identifiers are compatibility input only; new UIs, bots, and SDKs should not use them as the default display format.
- Transaction hashes, block hashes, public keys, private keys, and signatures remain `0x` hex.

## 3. Connectivity checks

### 3.1 Latest block

Verify the node is reachable and RPC works:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "get_latest_block",
    "params": {}
  }'
```

**Expected**: `result` includes `hash`, `height`, `timestamp`, etc., or `result: null` (node not synced yet).

### 3.2 Balance

Verify address format and the balance API:

```bash
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "get_balance",
    "params": { "address": "cera1sender..." }
  }'
```

**Note**: Use `cera1...` for new integrations and display; legacy `0x` + 32-byte ids are compatibility input only. **`available`** in the response is the node’s spendable balance: **`balance - pending_out` (saturated at 0)**, consistent with [transaction-flow §0](./transaction-flow.md#0-transaction-lifecycle); **`balance`** is on-chain confirmed balance. **Do not** recompute `available` / `pending_out` from local records ([api-reference §1](./api-reference.md#balance-and-pending-fields-protocol-level-constraints)).

## 4. Integration checklist

```
1. Configure RPC endpoint
2. Implement JSON-RPC 2.0 client (or use an existing library)
3. Wrap **`get_wallet_summary` (recommended)**, `get_balance`, `get_nonce`, `get_pending_transactions`, `get_transaction` / `get_transaction_receipt`, `send_transaction`, etc.
4. Implement transaction build and signing
5. Implement submission and status tracking
```

See [transaction-flow.md](./transaction-flow.md) and [api-reference.md](./api-reference.md) for details.

## 5. Error handling

### 5.1 JSON-RPC error format

When the node returns an error:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "hash or height required"
  }
}
```

### 5.2 Common error codes

| Code | Meaning | Suggested action |
|--------|------|----------|
| -32700 | Parse error | Check request JSON |
| -32601 | Method not found | Verify method name spelling |
| -32602 | Invalid params | Check param shape and required fields |
| -32000 | Internal error | Read `message`, e.g. "Mempool is full", "Invalid transaction" |

### 5.3 send_transaction business result (structured)

The node returns an object in JSON-RPC **`result`** (HTTP 200, no top-level `error`):

- **Success**: `{ "success": true, "hash": "0x..." }`
- **Failure**: `{ "success": false, "error": "<code>", "message": "..." }`; nonce errors may include **`expected_next_nonce`** (optional; saves one RPC)

**Standard error codes** (branch on code, not `message` alone):

| `error` | Meaning | Client |
|---------|------|--------|
| `ERR_NONCE_TOO_LOW` | Nonce behind chain+mempool (common with multi-client races) | **`get_wallet_summary`** again, re-sign/resend with new **`next_nonce`**, **~3 attempts max** |
| `ERR_NONCE_TOO_HIGH` | Node rejected too-high nonce | Same; **no** local `nonce++` |
| `ERR_INSUFFICIENT_BALANCE` | `available < amount + fee` | Inform user; do not auto-retry same params |
| `ERR_TX_ALREADY_EXISTS` | Same hash on chain or in pool | Treat as submitted or change content |
| `ERR_INVALID_TX` | Amount/fee/address rules failed | Fix params |
| `ERR_MEMPOOL_FULL` | Mempool full | Limited retry or try later |
| `ERR_FUTURE_NONCE_LIMIT` | Address future queue at cap | Ask user to wait or for lower-nonce txs to confirm |

**Current implementation note**: `cera-chain` may accept some high-nonce submissions into the mempool `future` bucket instead of always returning `ERR_NONCE_TOO_HIGH`. Wallets should:

- Handle `ERR_NONCE_TOO_HIGH` when the node returns it
- Not assume “high nonce always fails”
- Handle future queue overflow as `ERR_FUTURE_NONCE_LIMIT`

**Retry rule**: **Only** `ERR_NONCE_TOO_LOW` and `ERR_NONCE_TOO_HIGH` after refreshing summary; **do not** loop-retry balance/format errors.

Example: [send-transaction-with-retry.example.ts](./examples/send-transaction-with-retry.example.ts).

## 6. Network and timeouts

- Set request timeouts (e.g. 10–30 seconds).
- Limited retries on transient network failures (e.g. 2–3).
- If the node is down, clearly tell the user to check network or node config.

## 7. FAQ

| Symptom | Likely cause | Suggestion |
|------|----------|------|
| No response | Node down or port blocked | Check process, firewall, RPC port |
| Parse error | Invalid JSON body | Verify Content-Type and JSON |
| Invalid params | Missing fields or wrong types | Use object params, e.g. `{ "address": "..." }` |
| Tx stuck unconfirmed | Nonce/balance or node not producing blocks | `get_wallet_summary`; if you saw `ERR_NONCE_*`, retry per standard; confirm node is synced |

## 8. Next steps

- [API reference](./api-reference.md): RPC params and return values
- [Transaction flow](./transaction-flow.md): build through confirmation
- [Hybrid migration ops playbook](./hybrid-migration-ops-playbook.md): pre-checks, on-chain switch, blocking legacy single-sig after migration

## 9. Hybrid migration integration

If the wallet frontend supports `hybrid_ed25519_mldsa`, use this order:

1. `GET /api/wallet/account/post-quantum-readiness`
2. If `migration_prepared_locally = false`, prepare PQ key material first
3. If `migration_prepared_locally = true` but `migration_confirmed_on_chain = false`, guide the user to `/api/tx/migrate-hybrid`
4. If `migration_confirmed_on_chain = true`, subsequent sends must build ML-DSA proofs locally with `pqPrivateKey`; HTTP bodies only carry signed `auth_proofs` / `account_keys`, never `pqPrivateKey`

The frontend can drive banners, buttons, and copy from readiness fields:

- `recommended_next_step`
- `ui_banner_level`
- `ui_banner_message`
