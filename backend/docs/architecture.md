# CERA Wallet Architecture

This document describes the recommended architecture, core modules, and data flows for the CERA wallet. Use it when designing or evaluating a wallet implementation.

## 0. Boundary between wallet and CERA Core (node)

| Role | Responsibility |
|------|----------------|
| **CERA node (Core / Authority)** | Maintains the canonical chain, mempool, and account state; **single source of truth** for the next `nonce`, `balance` / `available` / `pending_*`, and other RPC return values. |
| **Wallet (Client)** | **Requests** the above via RPC; **assembles** transaction fields locally, **signs**, calls `send_transaction`; **displays** node responses. |

### 0.0 Positioning: stateless client

Treat the wallet as a **stateless client** (relative to chain and mempool):

- **Do not** maintain a wallet-local “chain state copy” that replaces the node for authorization decisions
- **Do not** compute the next `nonce` yourself or derive `available` / `pending_out` locally (rules come from the node; see protocol-level constraints in [api-reference.md](./api-reference.md))
- **Do not** participate in consensus or substitute for block production and validation order
- **Only**: hold keys securely, construct and **sign** from RPC data, display node results, implement [failure and retry policy](./transaction-flow.md) (see **§3. Failure and retry paths** in that document)

This matches “node = Authority, wallet = Client”: complex logic (nonce, mempool deductions) stays on the node; the wallet stays thin and evolvable.

**What the wallet must not do (double-spend / state drift prevention):**

- ❌ Do not use local rules to **replace** the node when inferring the “official nonce” (use `get_nonce` or `get_wallet_summary`).
- ❌ Do not treat **locally cached** balance as final on-chain state; before sending, use RPC (prefer **`get_wallet_summary`** or `get_balance`).
- ❌ Do not maintain a parallel “mempool view” in the wallet and use it to decide whether a transaction is finally valid (display may be cached; **authorization** follows the node).

**What the wallet should do:**

- ✅ Call the node for **nonce** before each send (or each batch in a concurrent queue).
- ✅ Prefer node **`available`** / **`get_wallet_summary`** on home and transfer screens.
- ✅ Treat `send_transaction` success/failure and receipts according to node responses.

### 0.1 Multi-entry consistency (Bot / Web / App)

When multiple clients **share the same on-chain address**:

- **Nonce**: **Protocol-mandatory** — use **`get_wallet_summary.next_nonce`** or **`get_nonce.nonce`**; details in [api-reference.md § Nonce usage rules (mandatory)](./api-reference.md#nonce-usage-rules-mandatory). **No** local increment, **no** inferring from pending, **no** long-lived cached nonce without a fresh RPC. Each entry must fetch the latest value **before every send**; prefer an application-level **serial queue** for “sign and send” on the same account so two clients do not build different transactions with the same nonce.
- **Balance and pending**: Prefer a single **`get_wallet_summary`** call so endpoints do not stitch `get_balance` + `get_pending_transactions` and briefly disagree.
- **Recovery**: If **`send_transaction`** fails due to nonce conflict or staleness, **call `get_wallet_summary`** again (or `get_nonce`), take the latest **`next_nonce`**, rebuild, and retry (with a limit) so users are not stuck on an old nonce.
- On chain, whichever transaction is **included in a block first** wins; multi-client races are a product coordination problem — the wallet **cannot** fabricate node-consistent finality.

---

## 1. Overall architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CERA Wallet                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐│
│  │ Key Manager  │  │  RPC Client  │  │  Transaction Engine      ││
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘│
│         │                 │                       │               │
│         └─────────────────┼───────────────────────┘               │
│                           │                                        │
│  ┌────────────────────────┼──────────────────────────────────────┐│
│  │              Business / application layer                    ││
│  │  Accounts | Balance | Transfer | History | Settings          ││
│  └────────────────────────┬──────────────────────────────────────┘│
│                           │                                        │
│  ┌────────────────────────┼──────────────────────────────────────┐│
│  │                    UI / presentation layer                     ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  CERA Node RPC  │
                    │   (HTTP :8545)  │
                    └─────────────────┘
```

## 2. Core modules

### 2.1 Key Manager

**Responsibility**: Generate, store, derive keys and addresses.

| Capability | Description |
|------------|-------------|
| Key generation | CSPRNG private keys per [signature-scheme](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md) |
| Address derivation | Public key → hash → 20 bytes → encoding (see [address-format](https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md)) |
| Key storage | Platform secure storage (Keychain, Keystore, Secure Enclave, etc.) |
| Mnemonic | Optional BIP-39 import/export |

**Security**: Private keys and mnemonics must not be stored in plaintext on non-secure storage or sent over the network.

### 2.2 RPC Client

**Responsibility**: Talk to the CERA node; wrap JSON-RPC calls.

| Capability | Description |
|------------|-------------|
| Connection | RPC endpoint config; mainnet/testnet switching |
| Request wrapping | Map app calls to JSON-RPC 2.0 |
| Error handling | Parse node errors into app-level types |
| Retry policy | Limited retries on network errors (configurable) |

**Dependencies**: Implement wrappers for **`get_wallet_summary` (recommended)**, `get_balance`, `get_nonce`, `get_pending_transactions`, `get_transaction`, `get_transaction_receipt`, `get_block`, `get_latest_block`, `send_transaction`, etc.

### 2.3 Transaction Engine

**Responsibility**: Build, sign, submit transactions; track status.

| Capability | Description |
|------------|-------------|
| Transaction build | Assemble fields from user input; fetch nonce and other required data from the node |
| Signing | Encode and sign per [transaction-encoding](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md) |
| Submission | Send signed transactions via `send_transaction` |
| Status tracking | Poll `get_transaction_receipt` or `get_transaction`; pending lists via `get_pending_transactions` |

See [transaction-flow.md](./transaction-flow.md) for the full flow.

### 2.4 Business / application layer

**Responsibility**: Accounts, balance display, transfers, history, settings.

| Capability | Description |
|------------|-------------|
| Account management | Create, import, switch active account |
| Balance display | **Prefer** `get_wallet_summary` in one call; if using only `get_balance`, show **`available`** as primary, optional on-chain `balance` and `pending_out`. **Do not** recompute locally (see [api-reference §1](./api-reference.md#balance-and-pending-fields-protocol-level-constraints)) |
| Transfer | Send CERA via the transaction engine |
| History | Optional: assemble history from block/transaction APIs |

### 2.5 UI layer

**Responsibility**: Interaction, display, confirmation.

Before transfer, show sender, recipient, amount, fee, nonce, etc., and require user confirmation before sign/submit.

## 3. Data flows

### 3.1 Balance / account summary

**Recommended (single request)**:

```
User opens home
    → RPC Client calls get_wallet_summary(address)
    → Parse balance / pending_out / pending_in / available / locked_balance / nonce
    → Business layer displays (do not recompute available or nonce on the client)
```

**Split calls (legacy integrations)**:

```
    → RPC Client calls get_balance(address)
    → Parse result.available (and balance / pending_out), result.block_height
```

### 3.2 Send transaction

```
User initiates transfer
    → Business layer collects: to, value, fee
    → RPC Client calls get_wallet_summary(from)   // recommended: next_nonce + available
      (or get_nonce(from) only; must satisfy api-reference §1 MUST)
    → Transaction engine builds { from, to, value, fee, nonce }
    → Key Manager signs
    → RPC Client calls send_transaction(params)
    → Parse result.success / result.hash; failure path see transaction-flow §3
```

See [transaction-flow.md](./transaction-flow.md) for details; **no local nonce/balance math** — [api-reference §1](./api-reference.md#1-general), [terminology-alignment.md](./terminology-alignment.md).

## 4. Module dependencies

```
UI layer
  └── Business layer
        └── Transaction engine ──→ Key Manager (signing)
        └── RPC Client (query and submit)
```

- **Transaction engine** depends on **Key Manager** for signing.
- **Transaction engine** and **business layer** depend on **RPC Client** and the node.
- **Key Manager** stays independent of RPC and network.

## 5. Technology suggestions

| Scenario | Suggestion |
|----------|------------|
| Web wallet | TypeScript/JavaScript; axios or fetch for RPC |
| Mobile | Native or cross-platform; platform secure storage APIs |
| Desktop | Electron / Tauri with OS key storage |
| SDK | Pure logic layer, UI-agnostic, reusable across clients |

## 6. Extensions

- **Multi-account**: Multiple addresses; switch active account.
- **Multi-network**: Mainnet/testnet config and switching.
- **Transaction history**: Build lists from block and transaction APIs.
- **Hardware wallet**: Pluggable external signer interface.
