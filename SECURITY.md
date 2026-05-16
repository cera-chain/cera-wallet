# Security Policy

## Supported versions

Security fixes are provided for the **current** `main` branch of this repository and the deployment you run from it. Older tags may not receive patches unless noted in release notes.

## Reporting a vulnerability

**Please do not** report security issues via public GitHub issues.

Send details to:

**[cerachain2026@gmail.com](mailto:cerachain2026@gmail.com)**

Subject line suggestion: `CERA Wallet security report`

Include, when possible:

- Description of the issue and impact
- Steps to reproduce
- Affected component (`frontend`, `backend`, or documentation only)
- Whether you believe keys, mnemonics, or signed transactions are at risk

We will acknowledge receipt on a best-effort basis and coordinate disclosure timing with you when appropriate.

## Out of scope for this repository

- Vulnerabilities in third-party dependencies (report to upstream; we may still bump versions here)
- Issues that require compromising the user’s device outside the wallet app
- Node (`cera-chain`) implementation bugs not reproduced through this wallet’s documented flows — still email us; we may forward internally

## Secure development reminders

See [backend/docs/security.md](backend/docs/security.md) for wallet key handling, custody models, and RPC boundaries.
