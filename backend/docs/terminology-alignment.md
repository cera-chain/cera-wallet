# Terminology Alignment (consistent strength across docs)

Multiple docs in this directory mention **nonce**, **available**, **pending**, **locked_balance**, etc. Weak or formula-only wording in one place leads SDK authors to misread requirements.

## Single source of truth (SSoT)

| Concept | **Normative constraints (MUST / MUST NOT)** | **Formulas and semantics (frozen field relations)** |
|------|----------------------------------|--------------------------------|
| **Nonce source and forbidden behavior** | [api-reference.md §1 — Nonce usage rules (mandatory)](./api-reference.md#nonce-usage-rules-mandatory) | Aligns with “next nonce” in [transaction-flow.md §0](./transaction-flow.md#0-transaction-lifecycle); **value** = `max(chain_nonce, pending_max_in_mempool) + 1` (node-computed) |
| **balance / pending_out / available / pending_in / locked_balance** | [api-reference.md §1 — Balance and pending fields](./api-reference.md#balance-and-pending-fields-protocol-level-constraints) | [transaction-flow.md §0](./transaction-flow.md#0-transaction-lifecycle) table and frozen rules |
| **send_transaction errors and retries** | [api-reference.md §2.4](./api-reference.md#24-send_transaction) | [transaction-flow.md §3](./transaction-flow.md#3-failure-and-retry-paths) |
| **Units / when `pending_in` appears / `locked_balance`** | [api-reference.md §1 — Units and field presence](./api-reference.md#units-precision-and-token-representation-current-node) | [transaction-flow §7 — sync and mempool](./transaction-flow.md#7-chain-sync-block-replacement-and-mempool) |
| **Transaction hash vs chain** | **`node_format::Transaction::hash`** ([transaction-flow §2.3](./transaction-flow.md#23-transaction-encoding-and-signing)) | [transaction-encoding](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md); if conflict, **follow the node you integrate with** |

**On-chain protocol SSoT** remains [cera-chain `rpc-api-spec.md`](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md); the table above is the **wallet-docs internal** index.

## Authoring conventions (maintainers)

- **architecture.md / README / integration-guide**: May summarize flows, but **must not** replace api-reference §1 **MUST** language with weak “suggested” wording; **link** to the sections above.
- **transaction-flow.md §0**: Owns **formulas and equalities** (e.g. `available = balance - pending_out`, `locked_balance = pending_out`); do not duplicate full MUST blocks here to avoid drift.
- **integration-guide**: “Minimal flow” defaults to **`get_wallet_summary`**, matching api-reference.

## Quick checklist

| Concept | Wrong (avoid) | Correct alignment |
|------|-------------------|--------------|
| nonce | “Increment from last tx +1” | **MUST** use `next_nonce` / `get_nonce.nonce`; link api-reference |
| available | “Available balance” with no formula | **Must use RPC fields**; formula in transaction-flow §0 or api-reference `get_balance` table |
| locked_balance | “May match pending” | **Normatively** `locked_balance === pending_out` (same string); UI may say “locked” |
| pending_in | Implies spendable | **Not in available**; display only |
