import type { DatabasePool } from "../db/pool.js";
import type { AccountRecord } from "../models/account.model.js";

export interface AccountRepository {
  findByAddress(ceraAddress: string): Promise<AccountRecord | null>;
  upsertByAddress(input: {
    ceraAddress: string;
    accountType: string;
    authMode: string;
    keyMaterialRef?: string;
    pqKeyMaterialRef?: string;
    ed25519PublicKey?: string;
    pqPublicKey?: string;
    pqKeyId: string;
    migrationVersion: number;
    derivationScheme?: string;
    derivationPath?: string;
    coinType?: number;
    accountIndex?: number;
    addressIndex?: number;
  }): Promise<AccountRecord>;
  updateHybridMigration(input: {
    ceraAddress: string;
    accountType: string;
    authMode: string;
    pqPublicKey: string;
    pqKeyMaterialRef?: string;
    pqKeyId: string;
    migrationVersion: number;
  }): Promise<AccountRecord>;
}

function dateFromRow(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function optionalString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapAccount(row: Record<string, unknown>): AccountRecord {
  return {
    ceraAddress: String(row.cera_address),
    accountType: String(row.account_type ?? "legacy_ed25519"),
    authMode: String(row.auth_mode ?? "single"),
    ed25519PublicKey: optionalString(row.ed25519_public_key),
    pqPublicKey: optionalString(row.pq_public_key),
    pqKeyId: String(row.pq_key_id ?? "pq-primary"),
    keyMaterialRef: optionalString(row.key_material_ref),
    pqKeyMaterialRef: optionalString(row.pq_key_material_ref),
    migrationVersion: Number(row.migration_version ?? 1),
    derivationScheme: optionalString(row.derivation_scheme),
    derivationPath: optionalString(row.derivation_path),
    coinType: row.coin_type === null || row.coin_type === undefined ? null : Number(row.coin_type),
    accountIndex:
      row.account_index === null || row.account_index === undefined
        ? null
        : Number(row.account_index),
    addressIndex:
      row.address_index === null || row.address_index === undefined
        ? null
        : Number(row.address_index),
    createdAt: dateFromRow(row.created_at),
    updatedAt: dateFromRow(row.updated_at),
  };
}

export function createPostgresAccountRepository(
  pool: DatabasePool
): AccountRepository {
  return {
    async findByAddress(ceraAddress: string) {
      const result = await pool.query(
        "SELECT * FROM wallet_accounts WHERE cera_address = $1",
        [ceraAddress]
      );
      return result.rows[0] ? mapAccount(result.rows[0]) : null;
    },

    async upsertByAddress(input) {
      const result = await pool.query(
        `INSERT INTO wallet_accounts (
          cera_address,
          account_type,
          auth_mode,
          key_material_ref,
          pq_key_material_ref,
          ed25519_public_key,
          pq_public_key,
          pq_key_id,
          migration_version,
          derivation_scheme,
          derivation_path,
          coin_type,
          account_index,
          address_index
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (cera_address) DO UPDATE
          SET account_type = EXCLUDED.account_type,
              auth_mode = EXCLUDED.auth_mode,
              key_material_ref = EXCLUDED.key_material_ref,
              pq_key_material_ref = EXCLUDED.pq_key_material_ref,
              ed25519_public_key = EXCLUDED.ed25519_public_key,
              pq_public_key = EXCLUDED.pq_public_key,
              pq_key_id = EXCLUDED.pq_key_id,
              migration_version = EXCLUDED.migration_version,
              derivation_scheme = EXCLUDED.derivation_scheme,
              derivation_path = EXCLUDED.derivation_path,
              coin_type = EXCLUDED.coin_type,
              account_index = EXCLUDED.account_index,
              address_index = EXCLUDED.address_index,
              updated_at = NOW()
        RETURNING *`,
        [
          input.ceraAddress,
          input.accountType,
          input.authMode,
          input.keyMaterialRef ?? null,
          input.pqKeyMaterialRef ?? null,
          input.ed25519PublicKey ?? null,
          input.pqPublicKey ?? null,
          input.pqKeyId,
          input.migrationVersion,
          input.derivationScheme ?? null,
          input.derivationPath ?? null,
          input.coinType ?? null,
          input.accountIndex ?? null,
          input.addressIndex ?? null,
        ]
      );
      return mapAccount(result.rows[0]);
    },

    async updateHybridMigration(input) {
      const result = await pool.query(
        `UPDATE wallet_accounts
        SET account_type = $2,
            auth_mode = $3,
            pq_public_key = $4,
            pq_key_material_ref = $5,
            pq_key_id = $6,
            migration_version = $7,
            updated_at = NOW()
        WHERE cera_address = $1
        RETURNING *`,
        [
          input.ceraAddress,
          input.accountType,
          input.authMode,
          input.pqPublicKey,
          input.pqKeyMaterialRef ?? null,
          input.pqKeyId,
          input.migrationVersion,
        ]
      );

      if (!result.rows[0]) {
        throw new Error("account not found");
      }

      return mapAccount(result.rows[0]);
    },
  };
}
