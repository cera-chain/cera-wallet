# CERA Wallet Security Practices

Security requirements and best practices for CERA wallet development and operations.

## 1. Core principles

| Principle | Description |
|------|------|
| Keys stay on device | Private keys and mnemonics are generated, stored, and used only on the user’s device; never sent over the network |
| Minimal exposure | Keep private keys in memory as briefly as possible; clear after use |
| Secure storage | Use OS or hardware secure storage |
| User confirmation | Sensitive actions (sign, export) require explicit user approval |

### 1.1 Custody model (products must declare)

CERA wallet docs **default to non-custodial**. If your product differs, state it clearly in privacy policy and terms.

| Model | Where keys sign | This guide |
|------|---------------------|------------|
| **Non-custodial** | User device; only signatures or signed txs leave the device | **Recommended**; matches “no keys on server” below |
| **Semi-custodial** | Encrypted key material on device, or server-held ciphertext/shares that cannot sign alone (product-defined) | Allowed with **written** key lifecycle and recovery |
| **Custodial** | Server holds signing keys | **Not recommended**; requires separate audit and compliance |

**Fixed defaults (avoid drift during implementation)**:

- Reference implementations in this doc scope: **private keys and mnemonics must not enter application servers**; signing happens on the client.
- Telegram Bot / server-side signing = **custodial**; outside default non-custodial; disclose risks and obtain user consent.

## 2. Key management

### 2.1 Key generation

- Use a **CSPRNG** (cryptographically secure random number generator) for private keys.
- Do not use `Math.random()` or other non-cryptographic sources.
- Algorithms: [signature-scheme](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md).

### 2.2 Key storage

| Platform | Suggested approach |
|------|----------|
| iOS | Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) |
| Android | Android Keystore / EncryptedSharedPreferences |
| Web | Avoid long-term storage in pure web; if required, strong encryption + password-derived keys |
| Desktop | OS Keychain / Credential Manager, or encrypted file + user password |

**Avoid**: Plaintext private keys or mnemonics in files, localStorage, databases, or logs.

### 2.3 Mnemonics

- If supported, follow BIP-39 (or protocol rules).
- Treat mnemonics like private keys for storage and transport.
- On export, show clear warnings and log the export event (not the mnemonic itself).

### 2.4 Wallet lock

- Auto-lock after idle time.
- Require unlock (PIN / biometrics / password) before sign or key export.

## 3. Signing security

### 3.1 Signing environment

- Sign **locally**; private keys do not leave the device.
- Avoid sensitive operations in unsafe environments (debug builds, jailbroken/rooted devices).

### 3.2 Transaction confirmation

- Before signing, show sender, recipient, amount, fee, nonce, etc.
- Show the full recipient address or a verifiable form to reduce clipboard substitution risk.

### 3.2.1 Clipboard and address substitution (address hijacking)

- Malware or web pages can **replace the clipboard** after the user copies an address; paste looks correct but points to an attacker.
- **Mitigations**: Show the **full** recipient address before signing (or segments + checksum / expand on tap); verify via a **second channel** (in-person QR, trusted contacts).
- **Web**: Avoid transfer flows that rely on a single paste; add explicit confirmation for large amounts.

### 3.3 Replay protection

- Each tx nonce must come from **`get_wallet_summary.next_nonce`** or **`get_nonce`** ([api-reference](./api-reference.md)); refresh RPC before every send to avoid duplicate nonces and conflicting unconfirmed sends.
- Do not reuse nonces; do not increment locally instead of RPC.

## 4. Communication security

### 4.1 RPC connections

- Prefer **HTTPS** in production.
- If using HTTP, clearly warn users to use trusted networks only.

### 4.2 Node trust

- Use trusted or self-hosted nodes; do not send sensitive queries to untrusted RPC.
- Nodes may log requests (addresses, txs) but **must not** receive private keys or mnemonics.
- **Hard boundary**: **RPC / full nodes never touch private keys**; keys exist only in the client signing path. Request bodies must not include private keys or mnemonics (only signed txs or public fields).

### 4.3 Man-in-the-middle

- HTTPS reduces MITM tampering risk.
- For critical txs, consider showing the transaction hash in the UI for user verification.

## 5. Application security

### 5.1 Dependencies and supply chain

- Use trusted crypto and signing libraries.
- Update dependencies regularly; patch known vulnerabilities.

### 5.2 Input validation

- Validate address and amount format and ranges.
- Guard against injection, oversized input, and similar abuse.

### 5.3 Logging and debugging

- Do not log private keys, mnemonics, or full raw transactions.
- Disable or limit debug output in production builds.

## 6. User education

### 6.1 Risk disclosure

- State clearly: lost private keys/mnemonics mean unrecoverable funds.
- Warn users not to share keys/mnemonics, screenshot them, or upload them online.

### 6.2 Backup guidance

- Guide users to back up mnemonics securely (e.g. paper, safe storage).
- Warn about risks when syncing across devices (use encrypted channels).

## 7. cera-chain references

- Signature scheme: [signature-scheme](https://cera.cash/docs/cera-chain/09-client-implementation/signature-scheme.md)
- Address format: [address-format](https://cera.cash/docs/cera-chain/09-client-implementation/address-format.md)
- Wallet development: [cera-chain wallet-development](https://cera.cash/docs/cera-chain/12-sdk/wallet-development.md)
