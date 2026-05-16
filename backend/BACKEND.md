# CERA Wallet Backend (Node.js / TypeScript)

> Implementation note  
> This document describes the **current** `cera-wallet` backend behavior. A shorter implementation snapshot lives in `./IMPLEMENTATION_STATUS.md`.

Express API that talks to the **CERA node JSON-RPC** for **Telegram Bot / Web** clients.

## Quick start

```bash
cd cera-wallet
cp .env.example .env
# Edit .env: RPC_URL, CERA_ED25519_SEED_HEX (openssl rand -hex 32)
npm install
npm run dev
```

- Health: `GET http://127.0.0.1:3000/api/health`
- Account summary: `GET/POST /api/wallet/summary?address=0xd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737`
- Pending txs: `GET/POST /api/wallet/pending?address=0xd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737`
- Transfer: `POST /api/tx/send`  
  ```json
  {
    "to": "0xa09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
    "amount": "10",
    "fee": "1",
    "privateKey": "1111111111111111111111111111111111111111111111111111111111111111"
  }
  ```
  `from` is optional; if omitted, the address is derived from `privateKey`.  
  `privateKey` is the **Ed25519 32-byte seed** (64 hex chars, optional `0x` prefix). **Do not send private keys in plaintext on the public internet in production**; use encrypted server storage + auth and sign internally instead.
- Persisted receipt: `GET /api/tx/receipt?tx_hash=0x...` (also `hash=`)  
  Node JSON-RPC **`get_receipt`** (`data/receipts.json`). **404** when missing. Success body: `tx_hash`, `block_number`, `status`, `from`, `to`, `amount`, `gas_used`, `logs`.
- Transaction status: `GET /api/tx/status?tx_hash=0x...`  
  Response: `{ "tx_hash", "status" }` where `status` is **`pending`** | **`confirmed`** | **`not_found`**. Tries **`get_receipt`** first; otherwise **`get_transaction`** (mempool `pending` and on-chain `included` count as confirmed).

## Directory layout

```
src/
  app.ts                 # Entry
  config/index.ts        # Environment variables
  rpc/client.ts          # JSON-RPC + send_transaction business result parsing
  rpc/types.ts
  rpc/methods.ts         # Thin wrappers around raw RPC methods
  services/wallet.service.ts
  services/tx.service.ts   # Nonce retry + balance check + signing
  services/signer.ts       # Ed25519 (tx preimage)
  utils/txHash.ts          # Preimage aligned with node Transaction::hash
  controllers/
  routes/
  models/                  # PostgreSQL account metadata (optional DATABASE_URL)
```

## Alignment with CERA wallet docs

1. **`send_transaction`**: Business failures use **`result.success === false`**, not top-level JSON-RPC `error` (handled by `RpcClient.callSendTransaction`).
2. **Nonce**: Only **`get_wallet_summary.next_nonce`**. On **`ERR_NONCE_TOO_LOW`** / **`ERR_NONCE_TOO_HIGH`**, refresh summary automatically (up to 3 times). Note: the current chain may also accept some high nonces into the future queue instead of always rejecting.
3. **Tx ID / signing input**: `utils/txHash.ts` matches `cera_execution::node_format::Transaction::hash` **preimage**; **excludes** `timestamp`, `signature`, `public_key`.
4. **RPC submit fields**: The wallet currently sends `from`, `to`, `value`, `fee`, `nonce`, `signature`, `public_key` to the node.
5. **Custody warning**: Server-held seed = **custodial** model. Production should use PostgreSQL (`DATABASE_URL`) for encrypted sensitive account metadata, enable authentication, and never pass keys in public request bodies.

## Common errors

- `FROM_MISMATCH`: Provided `from` (hex address) does not match the address derived from `privateKey`.
- `ERR_NONCE_TOO_LOW` / `ERR_NONCE_TOO_HIGH`: Nonce disagrees with the node’s chain or mempool view.
- `ERR_INSUFFICIENT_BALANCE`: `available < amount + fee`.
- `ERR_INVALID_SIGNATURE`: Node signature verification failed.
- `ERR_SIGNATURE_REQUIRED` / `ERR_PUBLIC_KEY_REQUIRED`: Missing required signing fields.
- `ERR_FROM_PUBLIC_KEY_MISMATCH`: Node rejects the `from` / `public_key` binding.
- `ERR_TX_ALREADY_EXISTS`: Same hash already in mempool or on chain.
- `ERR_MEMPOOL_FULL`: Node mempool is full.
- `ERR_FUTURE_NONCE_LIMIT`: Too many future-nonce txs for this address in the node mempool; the wallet maps this to HTTP **409** and does **not** auto-retry nonce.

See `docs/` and `docs/security.md` for full wallet documentation.

## Debugging stuck requests

1. Check console **`[tx.service]`** logs — note the last step printed.
   - Stops after **`→ get_wallet_summary`** with no **`returned`**: node RPC not responding or very slow → verify `RPC_URL`, node process, firewall.
   - Has **`summary returned`**, stops at **`→ await raw.send_transaction`**: stuck on **`send_transaction`** → same checks, or node deadlock (see node logs).
2. Timeout: default **30s** without an HTTP response throws **`RPC timeout after …ms`**. Set **`RPC_TIMEOUT_MS`** in `.env` if needed (fix connectivity first).

## Hybrid migration endpoints

The wallet backend exposes a post-quantum migration workflow for testnet demos and operator rehearsals.

- `GET /api/wallet/account?telegramUserId=...`
  - Returns local wallet account metadata plus chain summary from `get_wallet_summary`
- `GET /api/wallet/account/post-quantum-readiness?telegramUserId=...`
  - Returns local and on-chain migration status in one payload
  - Includes `postQuantumStatus` fields such as:
    - `local_account_type`
    - `chain_account_type`
    - `chain_auth_mode`
    - `local_pq_ready`
    - `migration_prepared_locally`
    - `migration_confirmed_on_chain`
    - `recommended_next_step`
- `POST /api/wallet/account/register`
  - Stores local wallet account metadata including `accountType`, `authMode`, `ed25519PublicKey`, `pqPublicKey`, `pqKeyMaterialRef`
- `POST /api/wallet/account/prepare-hybrid-migration`
  - Marks a local account as `hybrid_ed25519_mldsa`
  - Stores the target PQ public key and key reference
  - Does not submit a chain transaction by itself
- `POST /api/tx/migrate-hybrid`
  - Builds and submits the on-chain migration transaction
  - Uses a self-transfer with `value = 0` and a non-zero fee
  - Pushes target `account_type`, `auth_mode`, `account_keys`, and `migration_version` into the chain transaction payload

## Migration operations (reality)

- “Prepared locally” and “confirmed on chain” are intentionally different states
- A wallet may already hold PQ key material locally while the chain still reports a legacy account
- Once the migration transaction is confirmed, readiness will report:
  - `chain_account_type = hybrid_ed25519_mldsa`
  - `chain_auth_mode = hybrid`
  - `migration_confirmed_on_chain = true`
- After that point, subsequent submissions should use hybrid signing instead of legacy single-sign mode

## Demo flow

The example script at `docs/examples/hybrid-migration-demo.example.ts` shows the intended operator flow:

1. Query readiness before migration
2. Register or load the local wallet account
3. Prepare local hybrid migration metadata
4. Submit `POST /api/tx/migrate-hybrid`
5. Query readiness again and confirm the account is hybrid on chain
