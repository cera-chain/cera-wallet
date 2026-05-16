# CERA Transaction Flow

End-to-end flow from user transfer intent through construction, signing, submission, and confirmation.

**Division of labor with sibling docs**: **§0** here defines **field meaning and formulas** (`available`, `pending_*`, `locked_balance`, etc.). Protocol-level **MUST / MUST NOT** (no client-side nonce/balance math) live in [api-reference.md §1](./api-reference.md#1-general). Cross-doc index: [terminology-alignment.md](./terminology-alignment.md).

## 0. Transaction lifecycle

From the node’s perspective, a transaction typically follows:

```
User intent
  → Wallet (Client): RPC (nonce / balance)
  → Wallet: build tx + sign locally
  → RPC: send_transaction
  → Node: mempool (pending)
  → Block production: included in block
  → Canonical chain (confirmed / included)
```

Mapping to RPC fields (**all node-computed**):

| Concept | Meaning (current implementation) |
|------|------------------|
| **On-chain balance** | `get_balance.balance` / `get_wallet_summary.balance` |
| **pending_outgoing** | Sum of outgoing `amount+fee` in mempool → `pending_out` |
| **pending_incoming** | Sum of **`amount`** where `to` is this address in mempool → `pending_in` (`get_wallet_summary`) |
| **available_balance** | `balance - pending_out` (floor 0) → `available` |
| **locked_balance** | Same value as **pending_out** (dual semantics: technical field vs UI “locked”) → **`locked_balance` = `pending_out`**; do not split amount/fee/reserved separately |

**Frozen rules (aligned with `rpc-api-spec`)**:

- `pending_out` = sum of **`amount + fee`** for this address’s non-coinbase txs in mempool.
- `available` = `balance - pending_out` (saturated subtraction).
- **`pending_in` is UI-only**; **not** included in `available`; do not treat `balance + pending_in` as spendable (mempool incoming txs may be replaced or dropped).

Note: `pending_in` reflects **mempool-only** incoming; finality is on-chain.

**Client constraints (no duplicate normative text)**: For display and authorization, `balance` / `pending_out` / `available` / `locked_balance` / `next_nonce` **must** come from RPC; **do not** recompute from local tx history or a self-fetched mempool — [api-reference §1](./api-reference.md#balance-and-pending-fields-protocol-level-constraints).

---

## 1. Flow overview

```
User input (to, amount, fee?)
    → get_wallet_summary(from)   // recommended: next_nonce + available (no local math)
      (or get_nonce(from), equivalent to summary.next_nonce)
    → Build { from, to, value, fee, nonce }
    → Encode and sign
    → send_transaction
    → Receive tx hash
    → Poll get_transaction_receipt or get_transaction
```

**Integration**: Same as above — **default** to **`get_wallet_summary`**; nonce **MUST** source: [api-reference — Nonce usage rules (mandatory)](./api-reference.md#nonce-usage-rules-mandatory).

## 2. Detailed steps

### 2.1 Next nonce (authoritative source)

**Recommended**: `get_wallet_summary`, use **`result.next_nonce`** (same as **`result.nonce`**). **Equivalent**: `get_nonce`, use **`result.nonce`**. Both are node-computed `max(on-chain nonce, max nonce in mempool for address) + 1`. **No** local increment or inference from pending list — [api-reference — Nonce usage rules (mandatory)](./api-reference.md#nonce-usage-rules-mandatory).

Example below uses **`get_nonce`** only (`get_wallet_summary` request/response: [api-reference §2.3](./api-reference.md#23-get_wallet_summary-recommended)):

```http
POST / HTTP/1.1
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "get_nonce",
  "params": { "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f" }
}
```

`result.nonce` is the nonce for this send. If mempool already has unconfirmed txs, **another RPC** returns a higher nonce and avoids collision. If the account never sent on chain and mempool is empty, the first nonce is `1`.

**Note**: One nonce maps to one definite transaction body; **re-RPC before every send** (`get_wallet_summary` or `get_nonce`); **no** cached nonce or `lastNonce+1`.

### 2.2 Build transaction

Assemble from user input and **RPC `next_nonce` / `nonce`** from §2.1:

| Field | Source | Notes |
|------|------|------|
| `from` | Current account | Sender |
| `to` | User input | Recipient; must be valid |
| `value` | User input | Amount in smallest unit |
| `fee` | User input or default | Default 1 suggested; may adjust for congestion |
| `nonce` | **`get_wallet_summary.next_nonce`** or **`get_nonce.nonce`** | **Must** match node; else `NONCE_*` errors |

**Validation**:

- Amount > 0
- **Spendable** ≥ value + fee: use RPC **`available`** (`get_wallet_summary.available` or `get_balance.available`) = §0 `balance - pending_out` (saturated); **do not** recompute from local ledger
- Valid address format

### 2.3 Transaction encoding and signing

**Logical fields (match node `cera_execution::node_format::Transaction`)**:

| Field | JSON / RPC | Notes |
|------|------------|------|
| `from` | `Option<String>` | Sender for normal transfers |
| `to` | string | Required |
| `amount` | u64; RPC often `value` / `amount` | Smallest unit; see §0 / api-reference **units** |
| `nonce` | u64 | Must match `next_nonce` |
| `fee` | u64 | User txs must be **> 0** (current node) |
| `signature` | `Option<String>` | Optional on node; wallet should still sign per scheme |
| `is_coinbase` | bool | **false** for user txs |

**Transaction hash (RPC / mempool dedup — implementation wins)**

Current node `Transaction::hash()` (**may differ from some protocol docs; follow code**):

- Algorithm: **SHA-256**
- Concatenated input (in order): `from` UTF-8 (`None` → empty), `to` UTF-8, `amount` **big-endian u64**, `nonce` **be u64**, `fee` **be u64**, **1 byte** `is_coinbase` (0 or 1)
- **Excludes** `signature` (changing signature does not change tx hash)

RPC `hash` is typically **`0x` + hex(SHA256(...))**. For local tx id precomputation or alignment with `get_transaction` / `TX_ALREADY_EXISTS`, **use the rules above**.  
Protocol “canonical encoding”: [transaction-encoding](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md); on conflict with this node, **follow the node** and watch for future spec alignment.

**Signing**:

- Payload per [signature-scheme](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md); typically hash a **defined byte sequence** (usually **without** `signature`) then sign.
- **Note**: **Signing input** and **`Transaction::hash()` (mempool id)** are **not necessarily the same** unless your SDK intentionally unifies them.

Even if the node does not enforce signatures yet, implement local signing for forward compatibility.

### 2.4 Submit transaction

Submit via `send_transaction`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "send_transaction",
  "params": {
    "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f",
    "to": "0x8Ba1f109551bD432803012645Ac136ddd64DBA72",
    "value": 1000000,
    "fee": 1,
    "nonce": 3,
    "signature": "0x..."
  }
}
```

**Success**: `result.success === true` and `result.hash` is the transaction hash.

**Business failure**: `result.success === false` with structured `result.error` (e.g. `ERR_NONCE_TOO_LOW`, `ERR_INSUFFICIENT_BALANCE`, `ERR_TX_ALREADY_EXISTS`, `ERR_INVALID_TX`, `ERR_MEMPOOL_FULL`) and `result.message`. See [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md), [api-reference.md](./api-reference.md), and [RPC_TRANSACTION_CONTRACT.md](https://cera.cash/docs/cera-chain/RPC_TRANSACTION_CONTRACT.md).

**Standard send loop (Bot / Web)**:

1. `get_wallet_summary(address)` → `tx.nonce = next_nonce`
2. Build and sign → `send_transaction`
3. If `result.error` is **`ERR_NONCE_TOO_LOW`** or **`ERR_NONCE_TOO_HIGH`**: return to step 1, **max 3 retries** (only these errors)
4. **No** client `nonce++`, no cached nonce, no server rewriting nonce for you (node enforces)

**Current implementation note**: `cera-chain` may accept some high-nonce submissions into the mempool `future` bucket instead of always returning `ERR_NONCE_TOO_HIGH`. “High nonce” can mean explicit rejection or acceptance as a future transaction.

Example: [send-transaction-with-retry.example.ts](./examples/send-transaction-with-retry.example.ts).

**JSON-RPC top-level `error`**: Params, parse, unknown method, etc. — not the business codes above.

### 2.5 Confirm transaction

1. Poll **`get_transaction_receipt`** with the returned `hash`.
2. If receipt exists with `success === true` and `block_height` set → on chain.
3. If top-level JSON-RPC `receipt not found`, fall back to `get_transaction`:
   - `status === "pending"` → still in mempool
   - `status === "included"` with `block_height` → on chain
   - `result === null` → node has not seen the tx, evicted it, or not synced yet
4. Suggested timeout 60–120s; compare with **`get_pending_transactions(address)`** for outgoing pending list.

**Polling example**:

```javascript
async function waitForConfirmation(txHash, maxAttempts = 30, intervalMs = 4000) {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = await rpc("get_transaction_receipt", { hash: txHash });
    if (!receipt.error && receipt.result?.success === true) {
      return { status: "confirmed", blockHeight: receipt.result.block_height };
    }

    if (receipt.error && receipt.error.message === "receipt not found") {
      const tx = await rpc("get_transaction", { hash: txHash });
      if (tx.result?.status === "pending") return { status: "pending" };
      if (tx.result?.status === "included") {
        return { status: "confirmed", blockHeight: tx.result.block_height };
      }
      if (tx.result === null) return { status: "not_found" };
    }

    await sleep(intervalMs);
  }
  return { status: "timeout" };
}
```

## 3. Failure and retry paths

Besides “mempool → block”, integrations must handle the paths below explicitly; **do not** retry every failure as a nonce retry.

### 3.1 Business failures (`send_transaction` `result`)

| Scenario | Typical `result.error` | Action |
|------|---------------------|------|
| Stale nonce (multi-client, old summary) | `ERR_NONCE_TOO_LOW` | **`get_wallet_summary`** (or `get_nonce`), **re-sign/rebuild** with new **`next_nonce`**, `send_transaction` again; limit retries (e.g. 3); **no** local `nonce++` on retry |
| Node rejected high nonce | `ERR_NONCE_TOO_HIGH` | Same; must refresh via RPC; do not guess the next gap |
| Future queue full | `ERR_FUTURE_NONCE_LIMIT` | Wait for lower-nonce txs; retry later; do not skip nonces locally |
| Insufficient spendable | `ERR_INSUFFICIENT_BALANCE` | **No** auto-retry same amount; inform user |
| Duplicate | `ERR_TX_ALREADY_EXISTS` | Treat as submitted; do not resend same hash indefinitely |
| Format / rules / verify | `ERR_INVALID_TX` | Fix params/signature; new attempt still needs fresh RPC nonce |
| Node capacity | `ERR_MEMPOOL_FULL` | Limited retry or later; do not mix with nonce retry logic |

### 3.2 Network and transport failures

- **Timeout / disconnect / 5xx**: Limited retry of the **same HTTP request** (same body).
- If **uncertain** whether the node received the tx (no `result`): before sending again, **`get_wallet_summary`** and decide whether to re-sign with latest `next_nonce`; avoid blindly sending a second different tx when the first may have landed.

### 3.3 JSON-RPC top-level `error`

Invalid params, unknown method, parse errors: **fix the request**; not business codes above; **do not** apply `ERR_NONCE_*` retry logic.

## 4. Exception quick reference

| Situation | Suggested action |
|------|----------|
| `ERR_NONCE_*` | §3.1; refresh RPC nonce |
| `ERR_INSUFFICIENT_BALANCE` | Inform user; stop |
| `ERR_INVALID_TX` | Fix fee/fields; resend with fresh RPC nonce |
| `ERR_MEMPOOL_FULL` | Retry later or switch node |
| Network timeout | §3.2; if possibly submitted, check receipt / get_transaction |

## 5. Sequence diagram

```
User        Wallet UI   Tx engine   KeyManager   RPC Client   Node
  |           |            |            |             |            |
  |-- transfer ->|            |            |             |            |
  |           |-- get_wallet_summary -------->|------------>|  RPC       |
  |           |            |            |             |<------------|
  |           |<-- next_nonce / available ----|<------------|            |
  |           |-- build tx ->|            |             |            |
  |           |            |-- sign ------>|             |            |
  |           |            |<-- signature --|             |            |
  |           |            |-- send_tx ------------------>|  send_tx   |
  |           |            |            |             |<------------|
  |           |<-- tx hash -------------------------------|            |
  |           |-- poll receipt / get_tx ----->|------------>|  RPC       |
  |<-- done/fail -----------------------------------------|            |
```

## 6. Normative doc mapping

- Transaction format: [transaction-format](https://cera.cash/docs/cera-chain/05-execution/transaction-format.md) (general narrative; field-level **node_format** wins)
- Transaction encoding: [transaction-encoding](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md)
- Signature scheme: [signature-scheme](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md)
- RPC spec: [rpc-api-spec](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md)

## 7. Chain sync, block replacement, and mempool

**Goal**: After **P2P sync replaces the canonical chain**, do not assume cached pending / balance / nonce remain valid.

### 7.1 Current `cera-node` behavior (summary)

- The node may **replace the local canonical chain** with a peer’s chain via P2P (`Blockchain::replace_with_chain`, etc.).
- After **full chain replace**, the implementation **`mempool.clear()`** (see `p2p.rs` *Clearing mempool after chain replace*) so stale txs do not disagree with new state.
- **No** fine-grained rollback / `apply_block` event RPC for wallets; **poll RPC** as truth.

### 7.2 What wallets should do

- **Do not** assume mempool lists stay stable forever: after major sync they may **clear overnight**; `get_pending_transactions` can go empty suddenly.
- **Do not** cache `balance` / `available` / `next_nonce` as the sole authorization source; re-**`get_wallet_summary`** (or equivalent) **before user signs**, after **sync/reconnect**, and after **long idle**.
- Protocol docs on **reorg / checkpoint finality** ([consensus-overview](https://cera.cash/docs/cera-chain/04-consensus/consensus-overview.md)) describe **target capabilities**; whether your **light node** exposes fork-choice UI signals depends on **the node version you use**. For strong finality, define confirmation depth in product policy and **verify on chain**.

### 7.3 Relation to `apply_block` / rollback docs

- Wallets **do not** call `apply_block`; state transitions happen inside the node.
- [state-transition](https://cera.cash/docs/cera-chain/05-execution/state-transition.md) is **protocol-level**; **RPC-visible state** = node tip + mempool. After chain replacement, **“confirmed” on the old tip may be wrong** until the wallet refreshes RPC.
