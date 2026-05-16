# CERA Chain Specification References

Index of CERA protocol documents published for wallet and SDK integrators. All chain specs below are hosted at **[cera.cash/docs/cera-chain](https://cera.cash/docs/cera-chain/index.html)** (no local `cera-chain` checkout required).

Wallet-repo terminology index: [terminology-alignment.md](./terminology-alignment.md) (nonce / available / pending vs [api-reference §1](./api-reference.md#1-general)).

## 0. Authority levels (reading order)

| Level | Meaning | Examples on this page |
|------|------|------------------------|
| ⭐⭐⭐ **Normative (SSoT)** | Protocol and RPC **single source of truth** | `rpc-api-spec`, `RPC_TRANSACTION_CONTRACT`, `transaction-format`, `state-model`, `signature-scheme`, `address-format` |
| ⭐⭐ **Implementation reference** | Describes current node behavior; if it conflicts with ⭐⭐⭐, follow normative docs and file an issue | Wallet [api-reference](./api-reference.md) maps to node RPC |
| ⭐ **Examples / wallet docs** | Integration samples; **not** a protocol substitute | [send-transaction-with-retry.example.ts](./examples/send-transaction-with-retry.example.ts), other `.md` in this directory |

**Recommendation**: For disputes, read **⭐⭐⭐** first, then wallet docs; do not infer protocol rules from sample code alone.

## Quick index (all published specs)

| Document | URL |
|----------|-----|
| RPC API spec | https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md |
| RPC method index | https://cera.cash/docs/cera-chain/11-rpc-api/rpc-methods.md |
| RPC transaction contract | https://cera.cash/docs/cera-chain/RPC_TRANSACTION_CONTRACT.md |
| Transaction format | https://cera.cash/docs/cera-chain/05-execution/transaction-format.md |
| State transition | https://cera.cash/docs/cera-chain/05-execution/state-transition.md |
| Transaction encoding | https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md |
| Transaction validation | https://cera.cash/docs/cera-chain/09-client-implementation/transaction-validation.md |
| State model | https://cera.cash/docs/cera-chain/09-client-implementation/state-model.md |
| Signature scheme | https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md |
| Address format | https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md |
| Hash algorithm | https://cera.cash/docs/cera-chain/09-client-implementation/hash-algorithm.md |
| Cryptography overview | https://cera.cash/docs/cera-chain/09-client-implementation/cryptography.md |
| Block format | https://cera.cash/docs/cera-chain/09-client-implementation/block-format.md |
| Serialization | https://cera.cash/docs/cera-chain/09-client-implementation/serialization.md |
| Fee model | https://cera.cash/docs/cera-chain/06-economics/fee-model.md |
| Protocol parameters | https://cera.cash/docs/cera-chain/07-governance/protocol-parameters.md |
| Wallet development | https://cera.cash/docs/cera-chain/12-sdk/wallet-development.md |
| SDK development guide | https://cera.cash/docs/cera-chain/12-sdk/sdk-development-guide.md |
| Consensus index | https://cera.cash/docs/cera-chain/04-consensus/index.html |
| Consensus overview | https://cera.cash/docs/cera-chain/04-consensus/consensus-overview.md |

## Wallet integration reading path

Suggested order for building or reviewing a CERA wallet (maps to [integration-guide](./integration-guide.md) and [transaction-flow](./transaction-flow.md)):

1. [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md) + wallet [api-reference](./api-reference.md)
2. [RPC_TRANSACTION_CONTRACT.md](https://cera.cash/docs/cera-chain/RPC_TRANSACTION_CONTRACT.md)
3. [state-model.md](https://cera.cash/docs/cera-chain/09-client-implementation/state-model.md) + [transaction-format.md](https://cera.cash/docs/cera-chain/05-execution/transaction-format.md)
4. [address-format.md](https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md) + [signature-scheme.md](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md) + [transaction-encoding.md](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md)
5. [mnemonic-derivation-and-coin-type.md](./mnemonic-derivation-and-coin-type.md) (wallet repo; SLIP-0044 path `m/44'/68291'/0'/0'/0'`)
6. [fee-model.md](https://cera.cash/docs/cera-chain/06-economics/fee-model.md) + [wallet-development.md](https://cera.cash/docs/cera-chain/12-sdk/wallet-development.md)

For sync, reorg, and finality expectations, see [consensus-overview.md](https://cera.cash/docs/cera-chain/04-consensus/consensus-overview.md) (full list: [04-consensus index](https://cera.cash/docs/cera-chain/04-consensus/index.html)) and [state-transition.md](https://cera.cash/docs/cera-chain/05-execution/state-transition.md) ([transaction-flow §7](./transaction-flow.md#7-chain-sync-block-replacement-and-mempool)).

---

## 1. RPC and API

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐⭐ | [rpc-api-spec.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-api-spec.md) | Authoritative RPC methods, params, responses |
| ⭐⭐⭐ | [RPC_TRANSACTION_CONTRACT.md](https://cera.cash/docs/cera-chain/RPC_TRANSACTION_CONTRACT.md) | `send_transaction` submission rules and business errors |
| ⭐⭐ | [rpc-methods.md](https://cera.cash/docs/cera-chain/11-rpc-api/rpc-methods.md) | Method list and short descriptions |

## 2. Transactions and execution

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐⭐ | [transaction-format.md](https://cera.cash/docs/cera-chain/05-execution/transaction-format.md) | Field definitions and validation rules |
| ⭐⭐⭐ | [state-model.md](https://cera.cash/docs/cera-chain/09-client-implementation/state-model.md) | Accounts, balances, nonce |
| ⭐⭐ | [transaction-encoding.md](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-encoding.md) | Byte-level encoding and signing input |
| ⭐⭐ | [transaction-validation.md](https://cera.cash/docs/cera-chain/09-client-implementation/transaction-validation.md) | Format and state validation |
| ⭐⭐ | [state-transition.md](https://cera.cash/docs/cera-chain/05-execution/state-transition.md) | Protocol state machine; RPC-visible tip + mempool |

## 3. Cryptography and addresses

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐⭐ | [signature-scheme.md](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md) | Keys, signatures, verification |
| ⭐⭐⭐ | [address-format.md](https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md) | Address derivation and encoding (`cera1...`) |
| ⭐⭐ | [hash-algorithm.md](https://cera.cash/docs/cera-chain/09-client-implementation/hash-algorithm.md) | Transaction hash, block hash |
| ⭐⭐ | [cryptography.md](https://cera.cash/docs/cera-chain/09-client-implementation/cryptography.md) | RNG, keys, general requirements |

## 4. Blocks and serialization

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐ | [block-format.md](https://cera.cash/docs/cera-chain/09-client-implementation/block-format.md) | Block structure |
| ⭐⭐ | [serialization.md](https://cera.cash/docs/cera-chain/09-client-implementation/serialization.md) | General encoding rules |

## 5. Economics and governance

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐ | [fee-model.md](https://cera.cash/docs/cera-chain/06-economics/fee-model.md) | Fee calculation and distribution |
| ⭐⭐ | [protocol-parameters.md](https://cera.cash/docs/cera-chain/07-governance/protocol-parameters.md) | `MIN_GAS_PRICE`, max block size, etc. |

## 6. Consensus

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐ | [consensus-overview.md](https://cera.cash/docs/cera-chain/04-consensus/consensus-overview.md) | Entry point; [full index](https://cera.cash/docs/cera-chain/04-consensus/index.html) |

## 7. SDK and wallet (chain-side guidance)

| Tier | Document | Purpose |
|------|----------|---------|
| ⭐⭐ | [wallet-development.md](https://cera.cash/docs/cera-chain/12-sdk/wallet-development.md) | Feature and security requirements |
| ⭐⭐ | [sdk-development-guide.md](https://cera.cash/docs/cera-chain/12-sdk/sdk-development-guide.md) | SDK design principles |
| ⭐ | [mnemonic-derivation-and-coin-type.md](./mnemonic-derivation-and-coin-type.md) | **Wallet repo**: BIP-39 / SLIP-0010 path and coin type `68291` |

## 8. Wallet docs in this repository

| Document | Purpose |
|----------|---------|
| [api-reference.md](./api-reference.md) | RPC wrapper reference (aligned with `rpc-api-spec`) |
| [transaction-flow.md](./transaction-flow.md) | Build, sign, submit, confirm |
| [integration-guide.md](./integration-guide.md) | Node connectivity and minimal flow |
| [architecture.md](./architecture.md) | Wallet modules and data flow |
| [security.md](./security.md) | Keys, custody, signing safety |

## 9. Runtime mapping (private node code)

Published specs on **cera.cash** do not include node source. When debugging live behavior:

| Wallet doc | Typical node implementation (not public) |
|------------|------------------------------------------|
| api-reference.md | `node/src/rpc.rs` |
| transaction-flow.md | `crates/execution` (node_format, block_apply) |
| architecture.md | General design; not tied to one module |

If a published spec and your connected node disagree, treat the **node you run against** as runtime truth for that deployment; update published specs when the protocol changes.
