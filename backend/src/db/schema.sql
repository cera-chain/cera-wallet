CREATE TABLE IF NOT EXISTS wallet_accounts (
  cera_address TEXT PRIMARY KEY,
  account_type TEXT NOT NULL DEFAULT 'legacy_ed25519',
  auth_mode TEXT NOT NULL DEFAULT 'single',
  ed25519_public_key TEXT,
  pq_public_key TEXT,
  pq_key_id TEXT NOT NULL DEFAULT 'pq-primary',
  key_material_ref TEXT,
  pq_key_material_ref TEXT,
  migration_version INTEGER NOT NULL DEFAULT 1,
  derivation_scheme TEXT,
  derivation_path TEXT,
  coin_type INTEGER,
  account_index INTEGER,
  address_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS derivation_scheme TEXT,
  ADD COLUMN IF NOT EXISTS derivation_path TEXT,
  ADD COLUMN IF NOT EXISTS coin_type INTEGER,
  ADD COLUMN IF NOT EXISTS account_index INTEGER,
  ADD COLUMN IF NOT EXISTS address_index INTEGER;

DROP INDEX IF EXISTS idx_wallet_tx_records_owner_id;

ALTER TABLE IF EXISTS wallet_tx_records
  DROP CONSTRAINT IF EXISTS wallet_tx_records_owner_id_fkey,
  DROP COLUMN IF EXISTS owner_id;

ALTER TABLE wallet_accounts
  DROP CONSTRAINT IF EXISTS wallet_accounts_pkey,
  DROP COLUMN IF EXISTS owner_id,
  ADD PRIMARY KEY (cera_address);

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_cera_address
  ON wallet_accounts(cera_address);

CREATE TABLE IF NOT EXISTS wallet_tx_records (
  tx_record_id BIGSERIAL PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  fee TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_records_tx_hash
  ON wallet_tx_records(tx_hash);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_records_from_address
  ON wallet_tx_records(from_address);
