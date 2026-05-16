# Wallet Frontend Client-Side Signing Boundary

Date: 2026-05-08

## Current Rule

Wallet creation, transfer signing, staking signing, and hybrid/PQ transaction signing are client-side responsibilities.

The browser may temporarily receive user-entered secret material in form state, but the HTTP boundary must only receive signed transaction fields.

## What Must Stay In The Browser

- Ed25519 private key / seed
- 24-word mnemonic
- ML-DSA / PQ private key or seed
- Any future recoverable wallet secret

These values must not be posted to `cera-wallet`, `cera-node`, logs, telemetry, or analytics.

## What May Be Submitted

Transfer, staking, and migration requests may submit:

- `from`
- `to`
- `value` / `amount`
- `fee`
- `nonce`
- `signature`
- `public_key`
- `signature_scheme`
- `auth_mode`
- `account_type`
- `account_keys`
- `auth_proofs`
- `staking`

For hybrid accounts, the PQ private key is used locally to create an ML-DSA proof in `auth_proofs`; the PQ private key itself still does not leave the browser.

## Backend Guard

The wallet backend rejects transaction requests containing `privateKey`, `pqPrivateKey`, `mnemonic`, or `seed` with:

```text
CLIENT_SECRET_REJECTED
```

This is intentional. If this error appears after a deployment, first hard-refresh the browser or verify that the newest frontend bundle is being served.

## Implementation Pointers

- Local signing: `wallet-frontend/src/services/tx-signing.ts`
- Transfer and staking submit wrappers: `wallet-frontend/src/services/tx.ts`
- Backend signed-only gate: `cera-wallet/src/controllers/tx.controller.ts`
- Backend signed forwarding: `cera-wallet/src/services/tx.service.ts`
