# CERA Hybrid Migration Ops Playbook

This playbook is for testnet demos, operations staff, and integration partners. It turns the `legacy_ed25519 -> hybrid_ed25519_mldsa` migration into a repeatable, observable workflow with clear rollback signals.

## 1. Goals

- Prepare post-quantum (PQ) key material locally in the wallet
- Submit the on-chain migration transaction
- Confirm the account is in `hybrid` mode after migration
- Prevent accidental legacy single-signature sends after migration

## 2. Pre-migration checks

Call the readiness endpoint first:

```bash
curl "http://127.0.0.1:3000/api/wallet/account/post-quantum-readiness?telegramUserId=tg-demo"
```

Focus on `postQuantumStatus` in the response:

- `migration_prepared_locally`
- `migration_confirmed_on_chain`
- `chain_account_type`
- `chain_auth_mode`
- `ui_banner_level`
- `ui_banner_message`
- `recommended_next_step`

Three typical states:

1. Not prepared yet
   - `migration_prepared_locally = false`
   - `migration_confirmed_on_chain = false`
   - Action: prepare PQ key material first
2. Prepared locally, pending on-chain migration
   - `migration_prepared_locally = true`
   - `migration_confirmed_on_chain = false`
   - Action: submit `/api/tx/migrate-hybrid` next
3. Confirmed on chain
   - `migration_confirmed_on_chain = true`
   - `chain_account_type = hybrid_ed25519_mldsa`
   - `chain_auth_mode = hybrid`
   - Action: use dual-signature sends for all subsequent transactions

## 3. Prepare PQ material locally

Register or update the local account record:

```bash
curl -X POST http://127.0.0.1:3000/api/wallet/account/register \
  -H "Content-Type: application/json" \
  -d '{
    "telegramUserId": "tg-demo",
    "ceraAddress": "0xYOUR_ADDRESS",
    "accountType": "legacy_ed25519",
    "authMode": "single"
  }'
```

Then prepare hybrid migration metadata:

```bash
curl -X POST http://127.0.0.1:3000/api/wallet/account/prepare-hybrid-migration \
  -H "Content-Type: application/json" \
  -d '{
    "telegramUserId": "tg-demo",
    "pqPublicKey": "0xYOUR_MLDSA_PUBLIC_KEY",
    "pqKeyMaterialRef": "kms:mldsa:testnet-demo"
  }'
```

On success, query readiness again. You should see:

- `migration_prepared_locally = true`
- `migration_confirmed_on_chain = false`
- `ui_banner_level = "warning"`

## 4. Submit the on-chain migration transaction

Migration transactions must be signed in the wallet frontend/client. Do not send `privateKey`, `pqPrivateKey`, `mnemonic`, or `seed` to the `cera-wallet` HTTP service; doing so returns `CLIENT_SECRET_REJECTED`.

The request body below shows **signed fields**, not plaintext private keys:

```bash
curl -X POST http://127.0.0.1:3000/api/tx/migrate-hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xYOUR_ADDRESS",
    "to": "0xYOUR_ADDRESS",
    "value": "0",
    "fee": "1",
    "nonce": 1,
    "signature": "0xED25519_SIGNATURE",
    "public_key": "0xED25519_PUBLIC_KEY",
    "signature_scheme": "ed25519",
    "auth_mode": "hybrid",
    "account_type": "hybrid_ed25519_mldsa",
    "account_keys": [
      { "key_id": "primary", "scheme": "ed25519", "public_key": "0xED25519_PUBLIC_KEY" },
      { "key_id": "pq-primary", "scheme": "mldsa", "public_key": "0xMLDSA_PUBLIC_KEY" }
    ],
    "auth_proofs": [
      { "key_id": "primary", "scheme": "ed25519", "public_key": "0xED25519_PUBLIC_KEY", "signature": "0xED25519_SIGNATURE" },
      { "key_id": "pq-primary", "scheme": "mldsa", "public_key": "0xMLDSA_PUBLIC_KEY", "signature": "0xMLDSA_SIGNATURE" }
    ]
  }'
```

Notes:

- This is the formal on-chain migration action
- Under the hood it builds a migration transaction with `to == from` and `value = 0`
- The transaction submits the target `account_type`, `auth_mode`, and `account_keys` on chain

## 5. Confirm migration completed

After you receive `tx_hash`, check transaction status, then readiness:

```bash
curl "http://127.0.0.1:3000/api/tx/status?tx_hash=0xYOUR_TX_HASH"
curl "http://127.0.0.1:3000/api/wallet/account/post-quantum-readiness?telegramUserId=tg-demo"
```

When complete you should see:

- `migration_confirmed_on_chain = true`
- `chain_account_type = hybrid_ed25519_mldsa`
- `chain_auth_mode = hybrid`
- `ui_banner_level = "success"`
- `recommended_next_step = "use hybrid transaction signing for subsequent submissions"`

## 6. Send transactions after migration

After migration, the client must generate hybrid `auth_proofs` locally using the Ed25519 seed and PQ seed. The send endpoint still **must not** include `pqPrivateKey`:

```bash
curl -X POST http://127.0.0.1:3000/api/tx/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "0xYOUR_ADDRESS",
    "to": "bob",
    "amount": "10",
    "fee": "1",
    "nonce": 2,
    "signature": "0xED25519_SIGNATURE",
    "public_key": "0xED25519_PUBLIC_KEY",
    "signature_scheme": "ed25519",
    "auth_mode": "hybrid",
    "account_type": "hybrid_ed25519_mldsa",
    "account_keys": [
      { "key_id": "primary", "scheme": "ed25519", "public_key": "0xED25519_PUBLIC_KEY" },
      { "key_id": "pq-primary", "scheme": "mldsa", "public_key": "0xMLDSA_PUBLIC_KEY" }
    ],
    "auth_proofs": [
      { "key_id": "primary", "scheme": "ed25519", "public_key": "0xED25519_PUBLIC_KEY", "signature": "0xED25519_SIGNATURE" },
      { "key_id": "pq-primary", "scheme": "mldsa", "public_key": "0xMLDSA_PUBLIC_KEY", "signature": "0xMLDSA_SIGNATURE" }
    ]
  }'
```

If you still send with legacy single-signature after migration, the API returns:

- `error = "HYBRID_PQ_SEED_REQUIRED"`
- `ui_hint = "This account is in hybrid mode and can no longer send with legacy single-signature."`

Show this blocking message directly in the UI.

## 7. Suggested demo talking points

Good messaging for testnet or business demos:

- Accounts can prepare post-quantum key material locally first
- Then switch to a hybrid account via a formal on-chain transaction
- After migration, the system blocks accidental legacy single-signature sends
- The wallet can show in real time whether hybrid migration is complete

Messaging to avoid:

- “Fully post-quantum already”
- “Completely immune to quantum attacks”

## 8. Recommended demo sequence

1. Query readiness — show the account is still legacy
2. Run `prepare-hybrid-migration`
3. Query readiness again — show “prepared locally, not yet switched on chain”
4. Submit `/api/tx/migrate-hybrid`
5. Query `tx/status`
6. Query readiness again — show “hybrid confirmed on chain”
7. Send one transaction with dual signatures
8. Deliberately submit an Ed25519-only single-signature transaction to show how the system blocks legacy sends; never send `pqPrivateKey` to the backend
