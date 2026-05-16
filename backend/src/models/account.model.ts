/**
 * Custodial / semi-custodial metadata only.
 * Never store private keys, seed phrases, or raw PQ private material here.
 */
export interface AccountRecord {
  ceraAddress: string;
  accountType: string;
  authMode: string;
  ed25519PublicKey?: string | null;
  pqPublicKey?: string | null;
  pqKeyId: string;
  keyMaterialRef?: string | null;
  pqKeyMaterialRef?: string | null;
  migrationVersion: number;
  derivationScheme?: string | null;
  derivationPath?: string | null;
  coinType?: number | null;
  accountIndex?: number | null;
  addressIndex?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
