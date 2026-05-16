# wallet-frontend

Phase-1 wallet frontend for the frozen `cera-wallet` API.

## Local Run

1. Install dependencies

```powershell
npm.cmd install
```

2. Configure the API base

Copy `.env.example` to `.env` and adjust if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

3. Start the dev server

```powershell
npm.cmd run dev
```

4. Production build

```powershell
npm.cmd run build
```

5. Unified verification

```powershell
npm.cmd run verify
```

6. Frontend automated checks

```powershell
npm.cmd run test
```

7. Live closed-loop validation

```powershell
npm.cmd run test:live
```

## Validated Closed Loop

The following command was validated in this workspace as a minimal live loop for `cera-chain` plus `cera-wallet`:

```powershell
powershell -ExecutionPolicy Bypass -File ..\cera-chain\wallet_chain_live_validation.ps1 -RpcPort 18555 -P2pPort 16055 -WalletPort 13055 -MiningIntervalSeconds 2 -ConfirmTimeoutSeconds 120
```

What it verifies:

- starts a fresh dedicated chain
- starts the wallet API against that chain
- sends a real transaction
- waits for `confirmed`
- reads the persisted receipt
- restarts the node and verifies receipt persistence

Recommended routine:

- use `npm.cmd run verify` for the standard frontend verification pass
- use `npm.cmd run test` when you only want the fast test suite
- use `npm.cmd run test:live` when you need a real wallet-to-chain closed-loop verification

CI routine:

- GitHub Actions `wallet-frontend-verify` runs the standard `verify` path on Windows for wallet-related changes
- GitHub Actions `wallet-frontend-live-validation` is a manual workflow for the full live chain and wallet closed-loop check
- the live validation workflow builds `cera-node` and `cera-wallet` on the runner before executing `npm.cmd run test:live`

## Current Pages

- `Wallet`
- `Send`
- `Tracker`

## Address Format

- Newly created and imported wallets display account addresses as `cera1...`.
- The frontend may still accept legacy `0x` + 32-byte account identifiers where the backend supports compatibility input, but user-facing display should normalize back to `cera1...`.
- Transaction hashes, block hashes, public keys, private keys, and signatures remain `0x` hex values.
- Browser-side signing normalizes `cera1...` addresses to the chain's internal account identifier before submission.

## Wallet Scope

- This frontend is primarily a wallet action console.
- Its main responsibility is:
  - wallet summary and nonce checks
  - send flows
  - tracker flows
  - staking action flows
  - wallet-side account and migration flows
- Existing read-only system cards remain available as lightweight wallet diagnostics.
- New staking / finality / fork-choice observatory enhancements should not be added here.
- System-level observation work now belongs to:
  - `club123-backend`
  - `club123-frontend`

## Integration Rules

- nonce must come from chain `next_nonce`
- `mempool_status` must distinguish `pending` / `future`
- `included` must not be treated as `confirmed`
- receipt must use `block_height`
- wallet-side diagnostics may continue using wallet backend `/api/system/*` where needed for action support
- new system observation enhancements should be developed in the Club123 observatory stack instead of this wallet frontend

## Handoff Docs

- [docs/phase-summary-2026-04-21.md](F:/Bot/Club123-CERA/wallet-frontend/docs/phase-summary-2026-04-21.md)
- [WALLET_FRONTEND_PHASE1_PLAN_REVISED.md](F:/Bot/Club123-CERA/wallet-frontend/WALLET_FRONTEND_PHASE1_PLAN_REVISED.md)
- [FRONTEND_INTEGRATION_CHECKLIST.md](F:/Bot/Club123-CERA/wallet-frontend/FRONTEND_INTEGRATION_CHECKLIST.md)
- [FRONTEND_MANUAL_TEST_REPORT_2026-04-13.md](F:/Bot/Club123-CERA/wallet-frontend/FRONTEND_MANUAL_TEST_REPORT_2026-04-13.md)
- [FORK_CHOICE_DIAGNOSTIC_CODES_ZH.md](F:/Bot/Club123-CERA/wallet-frontend/FORK_CHOICE_DIAGNOSTIC_CODES_ZH.md)
