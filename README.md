# CERA Wallet

CERA Wallet is the reference wallet implementation for the CERA network. This repository contains the wallet backend API and the browser-based wallet frontend used for account management, transaction signing, transaction tracking, staking actions, and wallet-to-chain integration testing.

Official wallet: https://wallet.cera.cash

## Contact & maintainers

| | |
|--|--|
| **Maintainers** | CERA Protocol Maintainers |
| **Email** | [cerachain2026@gmail.com](mailto:cerachain2026@gmail.com) |
| **Protocol docs** | https://cera.cash/docs/cera-chain/index.html |
| **Security reports** | [SECURITY.md](./SECURITY.md) (private disclosure; not public issues) |

Details and scope: [MAINTAINERS.md](./MAINTAINERS.md).

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE).

Copyright (c) 2026 CERA Protocol Maintainers.

## Repository Layout

```text
cera-wallet/
  backend/    CERA wallet backend API and chain integration layer
  frontend/   CERA wallet web frontend
```

## Components

### Backend

The backend is an Express and TypeScript service that connects the wallet interface to a CERA node. It provides account, wallet, transaction, RPC, and system support APIs.

Key paths:

- `backend/src/` - backend source code
- `backend/tests/` - backend tests
- `backend/docs/` - backend API, architecture, security, transaction flow, integration, and coin type notes
- `backend/.env.example` - backend environment template

Local commands:

```powershell
cd backend
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

### Frontend

The frontend is a Vite, React, and TypeScript wallet interface for CERA account operations, send flows, transaction tracking, staking actions, and wallet diagnostics.

Key paths:

- `frontend/src/` - frontend source code
- `frontend/docs/` - frontend implementation and signing boundary notes
- `frontend/.env.example` - frontend environment template

Local commands:

```powershell
cd frontend
npm.cmd install
npm.cmd run verify
npm.cmd run dev
```

## Environment

Copy the example environment files before running the services locally:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Do not commit real `.env` files. They may contain local RPC URLs, database connection strings, service ports, or deployment-specific configuration.

## Security Boundary

This repository is intended to publish source code and documentation only. It must not include private keys, mnemonic phrases, production secrets, API keys, database dumps, logs, or generated dependency folders.

The frontend and backend use `.env.example` files to document required configuration without exposing private deployment values.

## CERA Wallet Scope

The CERA Wallet scope covers:

- account creation and import flows
- CERA address display and normalization
- wallet summary and nonce checks
- transaction creation, signing, submission, and tracking
- transaction receipt lookup
- staking action flows
- wallet backend integration with CERA node RPC
- wallet-specific API and security documentation

System-wide observability, explorer pages, marketing pages, and unrelated Club123 application modules are intentionally outside this repository.

## Documentation

For the full CERA protocol specification index (links to [cera.cash/docs/cera-chain](https://cera.cash/docs/cera-chain/index.html)), see [backend/docs/references.md](backend/docs/references.md).

Useful references:

- `LICENSE` (MIT)
- `MAINTAINERS.md` / `SECURITY.md`
- `backend/BACKEND.md`
- `backend/docs/README.md`
- `backend/docs/references.md` — protocol spec index (cera.cash)
- `backend/docs/api-reference.md`
- `backend/docs/architecture.md`
- `backend/docs/security.md`
- `backend/docs/transaction-flow.md`
- `backend/docs/mnemonic-derivation-and-coin-type.md`
- `docs/SLIP-0044-APPLICATION.md` — how to register coin type `68291` on SLIP-0044
- `frontend/README.md`
- `frontend/docs/client-side-signing-boundary-2026-05-08.md`

## Verification

Recommended checks before publishing or submitting this repository for review:

```powershell
cd backend
npm.cmd run typecheck
npm.cmd run build

cd ..\frontend
npm.cmd run verify
```

## Public Repository Notes

Before pushing to GitHub, confirm that Git is using this directory as the repository root and that ignored files are not staged:

```powershell
git status --short
```

The repository-level `.gitignore` excludes dependencies, build output, local environment files, logs, local run output, TypeScript build metadata, local databases, and archives.
