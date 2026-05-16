# SLIP-0044 Coin Type Application Guide (CERA)

This guide explains how to register coin type **`68291`** for CERA in [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md). Until the PR is **merged**, treat `68291` as an **internal provisional** number only.

## Current status

| Item | Status |
|------|--------|
| Wallet implements `m/44'/68291'/0'/0'/0'` | Done (`backend` + `frontend`) |
| Public docs & spec on cera.cash | Done |
| `cera-wallet` on GitHub with LICENSE / MAINTAINERS | https://github.com/cera-chain/cera-wallet (must be public before PR) |
| Row in official `slip-0044.md` | **Not done — you must open PR** |
| SLIP maintainers approved | **Not done — wait after PR** |

## What you are solving

1. **“68291 not in SLIP yet”** → Add one table row via PR to `satoshilabs/slips`.
2. **“SLIP not complete”** → Get that PR reviewed and merged; only then is the number official.

There is no email-only registration. The normative list lives in the slips repo.

## Before you open the PR

1. Push **`cera-wallet`** to a **public** GitHub repository: https://github.com/cera-chain/cera-wallet
2. Confirm these URLs work:
   - https://wallet.cera.cash
   - https://cera.cash/docs/cera-chain/index.html
   - https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md
3. Keep using **`68291`** in code until merge. If maintainers ask you to change the number (rare for first-come conflicts), update code + docs together — see [mnemonic-derivation-and-coin-type.md](../backend/docs/mnemonic-derivation-and-coin-type.md).

## Path to register (step by step)

### Step 1 — Fork and branch

1. Open https://github.com/satoshilabs/slips
2. Fork to your GitHub account
3. Clone your fork locally
4. Create branch: `slip-0044-cera-68291`

### Step 2 — Edit `slip-0044.md`

File: `slip-0044.md` in the repo root.

Find the table **“Registered coin types”**. Rows are sorted by **coin type number (ascending)**.

Insert **one row** for CERA (place it numerically among existing entries near other high numbers, or at the correct sorted position for `68291`):

```markdown
| 68291 | 0x80010A73 | CERA | CERA |
```

Column meanings:

| Column | Value | Notes |
|--------|--------|--------|
| Coin type | `68291` | Decimal index in BIP-44 path `m/44'/68291'/...` |
| Path component | `0x80010A73` | Hardened: `0x80000000 + 68291` |
| Symbol | `CERA` | Ticker |
| Coin | CERA | Full name |

**Derivation (for PR description, not necessarily in table):**

- BIP-39: 24 words, English
- SLIP-0010: Ed25519, **all hardened** child derivation
- Path: `m/44'/68291'/0'/0'/0'`
- Scheme id: `cera-mnemonic-v1`
- Implementation: [cera-wallet](https://github.com/cera-chain/cera-wallet) — `backend/src/services/mnemonic.ts`, `frontend/src/services/local-wallet.ts`

### Step 3 — Open pull request

Target: `satoshilabs/slips` → `master`

**Title (example):**

```text
slip-0044: add CERA (coin type 68291)
```

**Body (copy into the PR description as-is once https://github.com/cera-chain/cera-wallet is public):**

```markdown
## Summary

Register coin type **68291** for **CERA** (BIP-44 / SLIP-0044).

## Project

- **Name:** CERA
- **Symbol:** CERA
- **Website:** https://cera.cash
- **Wallet:** https://wallet.cera.cash
- **Public wallet implementation:** https://github.com/cera-chain/cera-wallet
- **Protocol documentation:** https://cera.cash/docs/cera-chain/index.html
- **Maintainer:** CERA Protocol Maintainers — cerachain2026@gmail.com

## Derivation

- **Path:** `m/44'/68291'/0'/0'/0'`
- **Mnemonic:** BIP-39, 24 words (256-bit entropy), English wordlist
- **Curve / SLIP-0010:** Ed25519 with hardened derivation at each level (no non-hardened path segments)
- **Documentation:** https://github.com/cera-chain/cera-wallet/blob/main/backend/docs/mnemonic-derivation-and-coin-type.md

## Existing implementation

A reference wallet (TypeScript, backend + browser frontend) already derives keys with this path. Tests assert `derivation_path === "m/44'/68291'/0'/0'/0'"`.

## Checklist

- [x] Row added in numeric order in `slip-0044.md`
- [x] Coin type not already used by another entry
- [x] Public repo and docs available for review
```

If you publish the wallet under a different GitHub account or organization, update the `github.com/cera-chain/cera-wallet` URLs in this block before submitting.

### Step 4 — Review and merge

- SatoshiLabs maintainers (e.g. Pavol Rusnak) may ask for changes or confirm the number is free.
- If they request a **different coin type**, do **not** merge silently: pick the new number, update `cera-wallet` code constants, docs, and keep old path support for existing users if any wallets already shipped.
- After merge, update [mnemonic-derivation-and-coin-type.md](../backend/docs/mnemonic-derivation-and-coin-type.md) status to “registered”.

## After merge (definition of done)

- [ ] Row visible on https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- [ ] Third-party wallets can rely on **68291** from the official list
- [ ] Your README / mnemonic doc state: **SLIP-0044 registered**

## If the PR is rejected or number collides

| Outcome | Action |
|---------|--------|
| **68291 already taken** | Choose the number maintainers suggest; update all `68291` constants in code + DB metadata for *new* accounts; document old path for recovery |
| **Ask for lower / different number** | Same as above |
| **Rejected (no working wallet)** | Point to public repo + tests; link `mnemonic-derivation-and-coin-type.md` |

## FAQ

**Can I use 68291 before merge?**  
Yes for **your own** testnet and coordinated releases, but label it **provisional** in docs. Hardware wallets and exchanges usually require SLIP listing.

**Must cera-chain source be public?**  
SLIP expects a **working wallet** and public **specs**. Full node source can stay private; publish protocol docs on cera.cash (already done).

**How long does review take?**  
Often days to weeks; depends on maintainer backlog. Polite follow-up on the PR after ~2 weeks is OK.

## Links

- SLIP-0044 spec: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
- BIP-0044: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- CERA mnemonic doc: [backend/docs/mnemonic-derivation-and-coin-type.md](../backend/docs/mnemonic-derivation-and-coin-type.md)
