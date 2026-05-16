# CERA Wallet Developer Documentation

Technical documentation for CERA wallet development, aimed at wallet developers, SDK authors, and integrators.

**Maintainers**: CERA Protocol Maintainers — [cerachain2026@gmail.com](mailto:cerachain2026@gmail.com) ([MAINTAINERS.md](../../MAINTAINERS.md))

## 🚀 3-minute start

1. **Start a node** and confirm RPC is reachable (default `http://127.0.0.1:8545`).
2. **POST** JSON-RPC `get_wallet_summary` with `address` in `params`.
3. Read **`next_nonce`** and **`available`** from `result`. **Do not** compute locally: `available` is already **`balance - pending_out` (floor 0)** from the node (see [transaction-flow §0](./transaction-flow.md#0-transaction-lifecycle)).
4. Build the transaction (`nonce` = `next_nonce`), sign locally, call **`send_transaction`**.
5. Poll with **`get_transaction_receipt`** (or `get_transaction`) until confirmed or timeout.

Details and retries: [integration-guide.md](./integration-guide.md) §2, [transaction-flow.md](./transaction-flow.md) §3, [api-reference.md](./api-reference.md).

## Backend (Node / Telegram)

The wallet **HTTP service** skeleton lives at the **`cera-wallet/`** repo root (`src/`, `package.json`). See [**BACKEND.md**](../BACKEND.md).

## Document index

| Document | Description |
|------|------|
| [Architecture](./architecture.md) | Overall design, modules, data flows |
| [Integration guide](./integration-guide.md) | Node integration steps and examples |
| [API reference](./api-reference.md) | RPC wrappers and call examples |
| [Mnemonic derivation & coin type](./mnemonic-derivation-and-coin-type.md) | 24-word BIP-39, SLIP-0010 Ed25519, internal coin type, SLIP-0044 application ([中文](./mnemonic-derivation-and-coin-type.zh.md)) |
| [Transaction flow](./transaction-flow.md) | Build, sign, submit, confirm |
| [Security](./security.md) | Key storage, signing safety, risk controls |
| [Hybrid migration ops playbook](./hybrid-migration-ops-playbook.md) | Testnet demos, ops checks, post-migration blocking |
| [References](./references.md) | cera-chain protocol doc index |
| [Terminology alignment](./terminology-alignment.md) | **SSoT index** for nonce / available / pending across docs |

## Quick start

1. **Architecture**: Read [architecture.md](./architecture.md) for core modules.
2. **Node integration**: Follow [integration-guide.md](./integration-guide.md) to configure RPC and verify connectivity.
3. **Sending**: Implement the send flow per [transaction-flow.md](./transaction-flow.md).

## Prerequisites

- CERA addresses use **hex/0x** (20 bytes) in some contexts; the test environment may also accept string addresses (e.g. `Alice`, `Bob`). Production UIs should prefer **`cera1...`** Bech32m (see [integration-guide §2.1](./integration-guide.md#21-address-format)).
- Transactions use **JSON-RPC 2.0 over HTTP**; balances are in **smallest integer units** (string or u64). See [api-reference §1](./api-reference.md#units-precision-and-token-representation-current-node).
- Full protocol docs: [cera-chain docs](https://cera.cash/docs/cera-chain/index.html).

## Version notes

Written against the current CERA node RPC implementation, aligned with [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md).

**Node alignment (wallet must-read)**:

- **Wallet = Client, node = Authority**: Final semantics for nonce, balance, and pending come from RPC; do not replace `get_nonce` / `get_wallet_summary` with local logic.
- **`get_wallet_summary` (recommended)**: One call for `balance` / `pending_out` / `pending_in` (**display only, not spendable**) / `available` / **`locked_balance` (normatively same as `pending_out`)** / **`next_nonce`** and `nonce` (same value). **MUST NOT** recompute `available`, `locked_balance`, or `max(chain_nonce,pending_max)+1` on the client; see [api-reference §1](./api-reference.md#1-general) and [terminology-alignment](./terminology-alignment.md).
- **`get_balance`**: Use **`available`** (mempool outgoing deducted) plus on-chain `balance`; `pending_out` is outgoing reservation.
- **`get_nonce`**: Includes mempool; **re-call before every send**; coordinate multi-entry sends at the product layer ([architecture.md](./architecture.md) §0.1).
- **`get_pending_transactions`** / **`get_transaction_receipt`**: Pending list and polling.
- **`send_transaction`**: Node **submission protocol** (fixed nonce / balance / dedup order); business outcome in **`result.success` + `result.error`**. Retry **`NONCE_*`** only after refreshing **`get_wallet_summary`**; see [examples/send-transaction-with-retry.example.ts](./examples/send-transaction-with-retry.example.ts).
- **Custody model**: Default **non-custodial** (keys on user device); server-side signing = custodial and must be disclosed ([security.md](./security.md) §1.1).
