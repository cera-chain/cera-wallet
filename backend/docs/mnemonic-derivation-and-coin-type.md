# CERA Wallet Mnemonic Derivation and Coin Type

This document records the mnemonic derivation rules currently used by the CERA wallet and follow-up items for applying for an official SLIP-0044 coin type.

> Chinese version: [mnemonic-derivation-and-coin-type.zh.md](./mnemonic-derivation-and-coin-type.zh.md)

## Current implementation

Wallet logic lives in `cera-wallet/src/services/mnemonic.ts`.

Current rules:

- Mnemonic standard: BIP-39 English wordlist
- Mnemonic length: 24 words
- Entropy: 256 bits
- Seed: BIP-39 `mnemonicToSeed`
- Ed25519 derivation: SLIP-0010 hardened derivation
- Derivation scheme id: `cera-mnemonic-v1`
- Current internal coin type: `68291`
- Current derivation path: `m/44'/68291'/0'/0'/0'`

Code constants:

```ts
export const CERA_MNEMONIC_DERIVATION_SCHEME = "cera-mnemonic-v1" as const;
export const CERA_MNEMONIC_DERIVATION_PATH = "m/44'/68291'/0'/0'/0'" as const;
```

Database fields:

- `derivation_scheme`
- `derivation_path`
- `coin_type`
- `account_index`
- `address_index`

## Path semantics

Meaning of `m/44'/68291'/0'/0'/0'`:

- `44'`: BIP-44 purpose
- `68291'`: CERA’s current internal coin type
- `0'`: account index
- `0'`: change / branch index (currently fixed at 0)
- `0'`: address index (currently fixed at 0)

Because signing uses Ed25519, derivation uses hardened child derivation throughout. Wallets, SDKs, mobile, browser, and any future hardware wallet integration **must** implement the same rules; otherwise the same 24-word mnemonic will restore different addresses.

## Current status

| Item | Status |
|------|--------|
| Used in wallet code (`68291`, path `m/44'/68291'/0'/0'/0'`) | **Yes** |
| Listed in official [SLIP-0044](https://github.com/satoshilabs/slips/blob/master/slip-0044.md) | **No — submit PR** (guide: [SLIP-0044-APPLICATION.md](../../docs/SLIP-0044-APPLICATION.md)) |

`68291` is CERA’s **provisional** coin type for development and coordinated releases. It becomes **official** only after a merged PR to `satoshilabs/slips`. Until then, do not describe it as “SLIP-registered” in external marketing.

Until a coin type is officially registered:

- Do not change coin type arbitrarily across clients.
- Do not update docs without updating code.
- Do not use different derivation paths for the same mnemonic on different platforms.

If you later move from `68291` to another number (e.g. after SLIP-0044 approval), update in sync:

- `cera-wallet/src/services/mnemonic.ts`
- Wallet backend tests
- Frontend copy
- SDK / mobile / browser implementations
- `derivation_path` and `coin_type` for new accounts in the database
- This document (and the `.zh.md` counterpart)

Existing wallets **cannot** silently switch derivation paths. If production wallets already exist, keep recovery support for old paths and distinguish versions via `derivation_scheme` / `derivation_path`.

## SLIP-0044 application follow-up

When preparing a SLIP-0044 coin type application, gather:

- Project name: CERA
- Ticker: CERA
- Official website
- Wallet or chain protocol documentation
- Public repository or reviewable implementation description
- Description of the derivation path in use
- Contact and maintainer information: [cerachain2026@gmail.com](mailto:cerachain2026@gmail.com) (CERA Protocol Maintainers; see [MAINTAINERS.md](../../MAINTAINERS.md))

Goals:

- Obtain an official, public, unique coin type number.
- Reduce collision risk with other chains or wallet implementations.
- Let third-party wallets, SDKs, hardware wallets, and browser extensions recognize CERA by standard.
