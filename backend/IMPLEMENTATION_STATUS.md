# CERA Wallet Implementation Status

Last updated: 2026-04-10

This file tracks the current code reality of `cera-wallet`.
It is intentionally short and should stay separate from product docs and future wallet plans.

## Current Scope

- TypeScript/Express wallet backend service
- RPC adapter layer for `cera-chain`
- Wallet summary, receipt, transaction status, and transfer submission APIs
- Development-oriented signing flow for local testing
- Hybrid Ed25519 + ML-DSA account preparation and migration flow

## Implemented Now

- Health endpoint and HTTP API service
- RPC integration with `cera-chain`
- Wallet summary queries via node RPC
- Pending/receipt/status lookup
- Transfer submission with:
  - automatic `next_nonce` fetch
  - nonce retry on `ERR_NONCE_TOO_LOW` / `ERR_NONCE_TOO_HIGH`
  - Ed25519 signing
  - `public_key` submission to the node
- Hybrid account submission with:
  - Ed25519 + ML-DSA65 dual-proof signing
  - explicit `account_type` / `account_keys` / `auth_proofs`
  - on-chain migration transaction builder
- Account management with:
  - local hybrid migration preparation
  - post-quantum readiness query
  - stored PQ key metadata references

## Transaction Submission Reality

- `POST /api/tx/send` can omit `from`
- When `from` is omitted, the wallet derives the address from the provided private key seed
- If `from` is provided as a hex address, the wallet checks that it matches the private key-derived address
- The wallet currently sends these RPC fields to the node:
- `from`
- `to`
- `value`
- `fee`
- `nonce`
- `signature`
- `public_key`
- `auth_proofs`
- `auth_mode`
- `account_type`
- `account_keys`
- optional `migration`

## Current Limitations

- The API still accepts a raw `privateKey` from the client during development
- This is suitable for local testing only
- There is no production-grade key custody, encryption, or browser-local signing flow yet
- PQ key references can now be stored, but there is still no production-grade encrypted custody/KMS enforcement
- The wallet service assumes the node RPC is reachable and authoritative for nonce/balance state

## Error Handling Reality

- Business failures from node `send_transaction` are expected in JSON-RPC `result`, not only in top-level RPC errors
- The wallet currently maps common node errors into HTTP-friendly responses, including:
  - invalid signature / missing signature metadata
  - nonce conflicts
  - insufficient balance
  - duplicate transaction
  - mempool full
  - `future nonce` queue limit

## Intended Use Right Now

- Local development
- Internal integration testing
- Backend adapter for bot/frontend experiments

## Not Fully Implemented Yet

- Production wallet security model
- Encrypted key storage
- Browser-local signing
- Formal account import/export UX
- Finalized transaction model beyond the current chain RPC contract
- Pure PQ (`pq_mldsa`) account submission
- Full front-end user UX for post-migration account management

## Recent Changes

- Added derived hex address support from Ed25519 private key seed
- Added `public_key` to outgoing transaction RPC params
- Allowed `from` to be omitted and auto-derived
- Added mismatch protection when supplied hex `from` does not match the provided private key
- Updated node error handling compatibility for structured `send_transaction` results
- Mapped `ERR_FUTURE_NONCE_LIMIT` to HTTP `409` without automatic nonce retry
- Added hybrid signer support via `@noble/post-quantum` ML-DSA65
- Added `/api/tx/migrate-hybrid`
- Added `/api/wallet/account/*` account-management endpoints
- Added post-quantum readiness reporting
