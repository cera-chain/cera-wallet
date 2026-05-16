# CERA Wallet API Reference

This document describes RPC methods wallets use to interact with a CERA node, and how to wrap them in a wallet or SDK. The full specification is in [cera-chain rpc-api-spec](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md).

## 1. General

- **Transport**: JSON-RPC 2.0 over HTTP
- **Content-Type**: `application/json`
- **Request body**: `{ "jsonrpc": "2.0", "id": <any>, "method": "<method>", "params": <object or null> }`
- **`id`**: May be a **number**, **string**, or **`null`** (per JSON-RPC 2.0); clients should echo it unchanged.
- **Parameter shape**: The current implementation expects **named parameter objects** (e.g. `{ "address": "..." }`); positional array params are not guaranteed.
- **Field naming**: Examples and node responses use **`snake_case`** (e.g. `block_height`, `pending_out`, `next_nonce`). If your wrapper uses camelCase, document the mapping.

### Address format update (2026-05-13)

- User-visible wallet addresses use `cera1...` Bech32m.
- New wallet UI, SDK, and API examples should prefer `cera1...` in `address`, `from`, `to`, validator addresses, staking targets, etc.
- Legacy `0x` + 32-byte account identifiers may still be accepted as input on some endpoints, but responses and display should normalize to `cera1...`.
- Transaction hashes, block hashes, public keys, private keys, and signatures remain `0x` hex; do not convert them to wallet address format.

### ⚠️ Balance and pending fields (protocol-level constraints)

Clients **MUST** use RPC numeric fields directly (from `get_wallet_summary` / `get_balance`), including but not limited to:

- `balance`
- `pending_out`
- `available`
- `pending_in` (display-only semantics)
- `locked_balance` (on **`get_wallet_summary`**, **normatively identical** to `pending_out`; do not derive locally)

Clients **MUST NOT** recompute these from local transaction history, local cache, or a self-fetched mempool view instead of the node. If the node changes mempool or aggregation rules, the wallet will **systematically drift** from authoritative state and may authorize incorrect transfers.

The presentation layer may **cache** RPC results (short TTL), but **`send_transaction` construction and “spendable” UI** must use the **latest** node response.

### ⚠️ Nonce usage rules (mandatory)

Clients **MUST** take the `nonce` for a transaction to sign from **exactly one** of these sources:

- **`get_wallet_summary.next_nonce`** (**recommended**; same value as `nonce`)
- or **`get_nonce.nonce`**

Clients **MUST NOT**:

- **Increment** `nonce` from a local sent-tx list (e.g. `lastNonce + 1`)
- **Infer** the “next nonce” from `get_pending_transactions` or a local mempool copy
- **Cache** nonce long-term and reuse across sends without a fresh RPC

Typical consequences of violating these rules: `send_transaction` returns **`ERR_NONCE_TOO_LOW` / `ERR_NONCE_TOO_HIGH`**, or in the current implementation high nonces may enter the future queue, worsening double-spend confusion or disagreeing with node finality. See [architecture.md](./architecture.md) §0 for boundaries.

### Units, precision, and token representation (current node)

- **Units**: `balance`, `pending_out`, `available`, `pending_in`, `locked_balance`, and `send_transaction` **`value` / `amount`, `fee`** are all in the **native coin’s smallest integer unit** in the current `cera-node` (internal **`u64`**, **no decimals**).
- **RPC encoding**: Balance-like fields are often **decimal strings** in JSON (avoid JS precision issues); `nonce`, `chain_nonce`, etc. are **JSON numbers**.
- **Precision / decimals**: Responses have **no** separate `decimals` field; **1 unit = 1 smallest on-chain integer**. If the protocol adds display decimals later, follow **`rpc-api-spec`** version updates.
- **Docs vs node**: [transaction-format.md](https://cera.cash/docs/cera-chain/05-execution/transaction-format.md) is general protocol narrative; wallet integration **follows current node RPC types and [rpc-api-spec](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md)**.

### Which methods expose which fields (avoid wrong integration)

| Field | `get_balance` | `get_wallet_summary` | Notes |
|------|---------------|----------------------|------|
| `balance` | ✅ | ✅ | On-chain confirmed balance (string) |
| `pending_out` | ✅ | ✅ | Outgoing mempool reservation |
| `available` | ✅ | ✅ | Node-computed spendable amount |
| `pending_in` | ❌ **not returned** | ✅ **always returned** | **`"0"`** when no incoming mempool txs; **display only** |
| `locked_balance` | ❌ **not returned** | ✅ **always returned** | Same value as **`pending_out`** in that response (`handle_get_wallet_summary` + `pending_outgoing_total_for_address`) |

**`pending_in` for developers**: Calling **`get_wallet_summary`** always returns `pending_in` (`"0"` if none). **Do not** expect it on `get_balance`; **do not** add `pending_in` to spendable balance. Full semantics: [transaction-flow §0](./transaction-flow.md#0-transaction-lifecycle).

**`locked_balance` on the node**: Same intermediate value as **`pending_out`** in **`handle_get_wallet_summary`** (`cera-chain/node/src/rpc.rs`) — sum of non-coinbase **`amount + fee`** for that address in mempool; no separate version field; logic changes follow node release notes / frozen `rpc-api-spec` tables.

## 2. Core wallet methods

### 2.1 get_balance

Query balance for an address.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get_balance",
  "params": {
    "address": "cera1sender..."
  }
}
```

**Response example**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "address": "cera1sender...",
    "balance": "1000",
    "pending_out": "100",
    "available": "900",
    "block_height": 1024
  }
}
```

| Field | Description |
|------|------|
| `balance` | **On-chain confirmed** balance (smallest unit), string |
| `pending_out` | Sum of `amount + fee` for this address’s non-coinbase txs in **mempool** |
| `available` | **Spendable** balance: `balance - pending_out` (floored at 0), string |
| `block_height` | Chain tip at query time; may be `null` |

**Wallet wrapper guidance**: Use **`available`** as “available balance” on home/transfer screens; optionally show `balance` and `pending_out` for unconfirmed debits. Values are strings — parse safely with `BigInt`, etc.

---

### 2.2 get_nonce

Get the nonce the next transaction for an address should use.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "get_nonce",
  "params": {
    "address": "cera1sender..."
  }
}
```

**Response example**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "address": "cera1sender...",
    "nonce": 3,
    "chain_nonce": 1,
    "pending_max_nonce": 2,
    "block_height": 1024
  }
}
```

| Field | Description |
|------|------|
| `nonce` | Nonce for the **next** tx (chain + mempool merged) |
| `chain_nonce` | Account nonce on chain (excludes mempool) |
| `pending_max_nonce` | Max nonce among this address’s mempool txs; `0` if none |
| `block_height` | Tip height at query time; may be `null` |

**Semantics**: `nonce = max(chain_nonce, pending_max_nonce) + 1`. First tx when chain is 0 and mempool empty is `1`; each call increments while multiple unconfirmed sends exist, avoiding duplicate nonces.

**Wallet wrapper guidance**: **Re-RPC before every** new send (see **Nonce usage rules (mandatory)** above). Serialize concurrent sends per account or refresh RPC each time; **do not** chain `nonce++` on the client.

---

### 2.3 get_wallet_summary (recommended)

**One call** returns the node’s view for an address: **on-chain balance**, **pending out/in**, **available**, **locked amount**, **next nonce** — all computed by the node. Clients **must not** compute `max(chain_nonce, pending_max_nonce) + 1` locally; use **`next_nonce`** (same as **`nonce`**). Semantics follow the **Normative wallet balance semantics (frozen)** table in [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md) for **`get_wallet_summary`**: `locked_balance` = `pending_out`; **`pending_in` is display-only and not included in `available`**.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "get_wallet_summary",
  "params": {
    "address": "cera1sender..."
  }
}
```

**Response example**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "address": "cera1sender...",
    "balance": "1000",
    "pending_out": "100",
    "pending_in": "50",
    "available": "900",
    "locked_balance": "100",
    "nonce": 4,
    "next_nonce": 4,
    "chain_nonce": 2,
    "pending_max_nonce": 3,
    "block_height": 1024
  }
}
```

| Field | Description |
|------|------|
| `address` | Queried address (normalized) |
| `block_height` | Tip height at query time; may be `null` |
| `chain_nonce` / `pending_max_nonce` | Diagnostic; **do not** use to compute `next_nonce` — use returned **`nonce` / `next_nonce`** |
| `balance` / `pending_out` / `available` | See **Units** above; **do not** derive `available` as `balance + pending_in` locally |
| `pending_in` | **Always returned** (`"0"` if none). Sum of non-coinbase **`amount`** in mempool where `to == address`; **UI / informational only**; not in `available`; not credited on chain |
| `locked_balance` | **Always returned**; **same numeric value as `pending_out`** (UI may label “locked”); same source as `pending_out` (`rpc.rs` `handle_get_wallet_summary` + `cera_mempool::pending_outgoing_total_for_address`) |
| `next_nonce` / `nonce` | **`max(chain_nonce, pending_max_nonce) + 1`** (node-computed); equal; **use as-is, do not recompute locally** |

---

### 2.4 send_transaction

Submit a transaction to the node (**protocol submission**, not a passive RPC read). The node validates in order: base fields → **nonce** (must match `get_wallet_summary.next_nonce`) → **available balance** → duplicate hash → mempool admission. See the **`send_transaction`** section in [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md).

**Standard client flow**: `get_wallet_summary` → build with **`next_nonce`** → `send_transaction` → if `result.error` is **`ERR_NONCE_TOO_LOW` / `ERR_NONCE_TOO_HIGH`**, refresh summary and **retry up to N times** (e.g. 3). **No** local `nonce++` or cached nonce.

**Request example (structured params)**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "send_transaction",
  "params": {
    "from": "cera1sender...",
    "to": "cera1recipient...",
    "value": 1000000,
    "fee": 1,
    "nonce": 3,
    "signature": "0x...",
    "public_key": "0x..."
  }
}
```

| Param | Type | Required | Description |
|------|------|------|------|
| `from` | string | yes | Sender address |
| `to` | string | yes | Recipient address |
| `value` / `amount` | number/string | yes | Transfer amount (smallest unit); equivalent |
| `fee` | number/string | no | Fee; default 1 (must be &gt; 0) |
| `nonce` | number | yes | **Must** match `get_wallet_summary.next_nonce` |
| `signature` | string | yes | Ed25519 signature; required for user txs on current node |
| `public_key` | string | yes | Ed25519 public key; required for user txs on current node |

**cera-wallet HTTP boundary**: `/api/tx/send`, `/api/tx/staking/*`, and `/api/tx/migrate-hybrid` accept **already-signed** transaction fields only. The body **must not** include `privateKey`, `pqPrivateKey`, `mnemonic`, or `seed`; if present, the service returns `CLIENT_SECRET_REJECTED`. Private keys, mnemonics, and PQ seeds must stay in the browser/client signing flow.

**Success response** (business success; JSON-RPC layer still succeeds):

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "success": true,
    "hash": "0xa1b2c3d4e5f6..."
  }
}
```

**Business failure response** (still JSON-RPC `result`, not top-level `error`):

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "success": false,
    "error": "ERR_NONCE_TOO_LOW",
    "message": "nonce 3 is behind expected next 5; refresh get_wallet_summary and retry",
    "expected_next_nonce": 5
  }
}
```

#### send_transaction error codes (normative)

These **`result.error` strings** match the node contract. SDKs **MUST** branch on them and **MUST NOT** retry every failure as a nonce retry.

| `result.error` | Meaning | Client handling (branch by code; no “retry everything”) |
|----------------|------|--------------------------------------------------------|
| `ERR_NONCE_TOO_LOW` | Nonce behind chain+mempool (incl. multi-client races) | **Retry allowed**: **`get_wallet_summary`** (or `get_nonce`), **re-sign/rebuild** with **new** `next_nonce`, then `send_transaction`; **no** local `nonce++` on retry |
| `ERR_NONCE_TOO_HIGH` | Node explicitly rejected too-high nonce | **Retry allowed**: same as above; **must** re-RPC for nonce; do not guess gaps |
| `ERR_INSUFFICIENT_BALANCE` | `available < amount + fee` (node authority) | **No** auto-retry for same params; ask user to lower amount or fund |
| `ERR_TX_ALREADY_EXISTS` | Same hash on chain or in mempool | **No** blind resend of same payload; treat as submitted or change content |
| `ERR_INVALID_TX` | Amount/fee/address/encoding invalid | **No** auto-retry; fix params |
| `ERR_MEMPOOL_FULL` | Node capacity (mempool full) | **Optional** limited retry or “try later”; **do not** mix with nonce retry logic |
| `ERR_FUTURE_NONCE_LIMIT` | Address future queue at cap | Ask user to wait or for lower-nonce txs to execute |

**Current implementation note**: `cera-chain` may accept some high-nonce submissions into the mempool `future` bucket instead of always returning `ERR_NONCE_TOO_HIGH`. Clients must handle `ERR_NONCE_TOO_HIGH` but must not assume “high nonce always fails.”

**JSON-RPC top-level `error`**: Parse errors, unknown method, `Invalid params` (e.g. missing required fields), etc. — not the business codes above.

**Network failures** (timeout, ECONNRESET, HTTP 5xx): Limited retry of the **same request** is OK; **do not** change nonce on network-only retry unless you never got `result` and need a fresh nonce for a **new** submission.

**Notes**: Structured params supported; `raw_tx` also available (see node docs). Bot/Web: [send-transaction-with-retry.example.ts](./examples/send-transaction-with-retry.example.ts).

#### Hybrid / post-migration wallet hints

If the wallet backend uses the `cera-wallet` HTTP layer, hybrid migration may return errors tailored for the frontend:

| Code | Meaning | Frontend guidance |
|------|------|------|
| `HYBRID_PQ_SEED_REQUIRED` | Account is hybrid but request used legacy single-sig | Block send; prompt user to add `pqPrivateKey` locally for hybrid signing; **never** send `pqPrivateKey` to the backend |
| `MIGRATION_REQUIRES_LEGACY_ACCOUNT` | Account is no longer legacy; cannot migrate again | Prompt readiness check instead of repeating migration |
| `PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET` | Wallet cannot submit pure `pq_mldsa` accounts yet | Direct user to hybrid accounts for now |

Recommended companion endpoints:

- `GET /api/wallet/account/post-quantum-readiness`
- `POST /api/wallet/account/prepare-hybrid-migration`
- `POST /api/tx/migrate-hybrid`

Check account state **before** send, not only after failure.

---

### 2.5 get_transaction

Look up a transaction by hash.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "get_transaction",
  "params": {
    "hash": "0xa1b2c3d4e5f6..."
  }
}
```

**Response example (included in block)**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "hash": "0xa1b2c3d4e5f6...",
    "from": "cera1sender...",
    "to": "cera1recipient...",
    "value": "1000000",
    "fee": "1",
    "nonce": 3,
    "block_hash": "0x0086b9c9...",
    "block_height": 1025,
    "index_in_block": 1,
    "status": "included"
  }
}
```

**Response example (pending)**:

```json
{
  "result": {
    "hash": "0xa1b2c3d4e5f6...",
    "from": "cera1sender...",
    "to": "cera1recipient...",
    "value": "1000000",
    "fee": "1",
    "nonce": 3,
    "block_hash": null,
    "block_height": null,
    "index_in_block": null,
    "status": "pending"
  }
}
```

**Not found**: `result` is `null`.

---

### 2.6 get_pending_transactions

List **mempool** outgoing transactions (non-coinbase) for an address — for a “pending” UI.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "get_pending_transactions",
  "params": {
    "address": "cera1sender..."
  }
}
```

**Response example**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": [
    {
      "hash": "0x...",
      "nonce": 3,
      "status": "pending",
      "to": "cera1recipient...",
      "value": "10",
      "fee": "1"
    }
  ]
}
```

Empty list: `result` is `[]`.

**Relation to `get_wallet_summary`**: These txs are the same outgoing mempool set used for **`pending_out` / `available`** (filtered by address); **not** incoming pending (those appear only in **`pending_in`**). After **P2P full chain replacement** the node may **clear mempool** and the list goes empty abruptly — see [transaction-flow §7](./transaction-flow.md#7-chain-sync-block-replacement-and-mempool). Entry **`hash`** rules match [§2.3 transaction hash](./transaction-flow.md#23-transaction-encoding-and-signing).

---

### 2.7 get_transaction_receipt

Lightweight receipt by hash — useful to confirm entry into the persistent receipt view.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "get_transaction_receipt",
  "params": {
    "hash": "0xa1b2c3d4e5f6..."
  }
}
```

(`tx_hash` is equivalent to `hash`.)

**Response example (in canonical receipt store)**:

```json
{
  "result": {
    "tx_hash": "0x...",
    "block_height": 100,
    "success": true
  }
}
```

**Current implementation notes**:

- If the tx is in the persistent receipt view, returns the `result` above
- If not found, returns top-level JSON-RPC `error`
- When polling, do not treat a missing `get_transaction_receipt` as a stable `pending` object. Prefer:
  - `get_transaction_receipt` first
  - On `receipt not found`, fall back to `get_transaction`
  - `get_transaction.status === "pending"` → still in mempool
  - `get_transaction.result === null` → node has not seen the tx or it was evicted

---

### 2.8 get_block

Query a block by hash or height.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "get_block",
  "params": {
    "height": 1024,
    "include_transactions": true
  }
}
```

Or by hash:

```json
{
  "params": {
    "hash": "0x0086b9c9257cf4a4f6af85b741189dfb2dfee344b9438f60032e87bf1fbf7600",
    "include_transactions": true
  }
}
```

**Note**: Provide `hash` **or** `height`; if both are given, `hash` wins.

---

### 2.9 get_latest_block

Get the latest block.

**Request example**:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "get_latest_block",
  "params": {
    "include_transactions": false
  }
}
```

## 3. Typical call sequences

| Scenario | Call order |
|------|----------|
| Home / account summary (recommended) | **`get_wallet_summary`** |
| Balance display (split calls) | `get_balance` → show **`available`** (optional `balance` / `pending_out`) |
| Pending list | `get_pending_transactions` |
| Send transaction | **`get_wallet_summary`** → `next_nonce` → build → sign → `send_transaction` (on failure see `result.error`; `NONCE_*` → refresh summary and retry — [example](./examples/send-transaction-with-retry.example.ts)) |
| Confirm transaction | Poll **`get_transaction_receipt`** or `get_transaction` |
| Sync state | `get_latest_block` for current height |

## 4. SDK wrapper examples (pseudocode)

```javascript
// Balance: prefer available; raw balance is on-chain confirmed
async function getBalance(address) {
  const res = await rpc("get_balance", { address });
  if (res.error) throw new Error(res.error.message);
  const r = res.result;
  return {
    balance: BigInt(r.balance),
    pendingOut: BigInt(r.pending_out),
    available: BigInt(r.available),
    blockHeight: r.block_height,
  };
}

// Nonce — call before every send
async function getNonce(address) {
  const res = await rpc("get_nonce", { address });
  if (res.error) throw new Error(res.error.message);
  return res.result.nonce;
}

// Account summary (recommended: Bot / Web / App use node-aggregated fields)
async function getWalletSummary(address) {
  const res = await rpc("get_wallet_summary", { address });
  if (res.error) throw new Error(res.error.message);
  return res.result;
}

// Pending transaction list
async function getPendingTransactions(address) {
  const res = await rpc("get_pending_transactions", { address });
  if (res.error) throw new Error(res.error.message);
  return res.result;
}

// Send (check result.success; business errors live in result, not top-level error)
async function sendTransaction(tx) {
  const res = await rpc("send_transaction", tx);
  if (res.error) throw new Error(res.error.message);
  const r = res.result;
  if (!r.success) throw new Error(`${r.error}: ${r.message || ""}`);
  return r.hash;
}

// Production: use NONCE_* retry wrapper — examples/send-transaction-with-retry.example.ts

// Transaction detail (result may be null)
async function getTransaction(hash) {
  const res = await rpc("get_transaction", { hash });
  if (res.error) throw new Error(res.error.message);
  return res.result;
}

// Lightweight receipt polling
async function getTransactionReceipt(hash) {
  const res = await rpc("get_transaction_receipt", { hash });
  if (res.error) throw new Error(res.error.message);
  return res.result;
}
```
