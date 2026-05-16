import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { transactionIdHashBytes } from "../utils/txHash.js";

// @noble/ed25519 v2：同步 API 需注入 SHA-512（错误文案仍写 "hashes.sha512Sync"）
ed.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed.etc.concatBytes(...messages));

export const DEFAULT_SIGNATURE_SCHEME = "ed25519" as const;
export type SignatureScheme = typeof DEFAULT_SIGNATURE_SCHEME;
export const DEFAULT_ACCOUNT_TYPE = "legacy_ed25519" as const;
export type AccountType =
  | typeof DEFAULT_ACCOUNT_TYPE
  | "hybrid_ed25519_mldsa"
  | "pq_mldsa";

export interface AccountKeyRef {
  scheme: string;
  public_key: string;
  key_id: string;
}

export interface AccountMigrationRef {
  target_auth_mode: string;
  target_account_type: string;
  target_account_keys: AccountKeyRef[];
  target_migration_version?: number;
}

export interface StakingActionRef {
  kind: string;
  validator_address?: string;
  consensus_public_key?: string;
}

export interface UnsignedTransfer {
  from: string;
  to: string;
  amount: bigint;
  nonce: bigint;
  fee: bigint;
  migration?: AccountMigrationRef;
  staking?: StakingActionRef;
}

const txHashInput = (tx: UnsignedTransfer) => ({
  from: tx.from,
  to: tx.to,
  amount: tx.amount,
  nonce: tx.nonce,
  fee: tx.fee,
  migration: tx.migration,
  staking: tx.staking,
  isCoinbase: false as const,
});

/** 从 32-byte seed 派生 Ed25519 密钥对（与 @noble/ed25519 一致） */
export function keypairFromSeed(seed32: Uint8Array): {
  secretSeed: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
} {
  const publicKey = ed.getPublicKey(seed32);
  return {
    secretSeed: seed32,
    publicKey,
    publicKeyHex: Buffer.from(publicKey).toString("hex"),
  };
}

/**
 * Ed25519（@noble/ed25519）：对 **tx.hash** 签名 — 即 `SHA256(preimage)` 的 32 字节，
 * 与 Rust `cera_execution::node_format::Transaction::hash` 一致。**不使用 HMAC。**
 * 返回签名 **hex**（128 个十六进制字符，对应 64 字节签名）。
 */
export function signTransfer(
  tx: UnsignedTransfer,
  seed32: Uint8Array
): {
  signatureScheme: SignatureScheme;
  accountType: AccountType;
  signatureHex: string;
  publicKeyHex: string;
  accountKeys: AccountKeyRef[];
  authProof: {
    scheme: SignatureScheme;
    public_key: string;
    signature: string;
    key_id: string;
  };
} {
  const txHashBytes = transactionIdHashBytes(txHashInput(tx));
  const sig = ed.sign(txHashBytes, seed32);
  const signatureHex = Buffer.from(sig).toString("hex");
  const publicKeyHex = Buffer.from(ed.getPublicKey(seed32)).toString("hex");
  const accountKeys: AccountKeyRef[] = [
    {
      scheme: DEFAULT_SIGNATURE_SCHEME,
      public_key: `0x${publicKeyHex}`,
      key_id: "primary",
    },
  ];
  return {
    signatureScheme: DEFAULT_SIGNATURE_SCHEME,
    accountType: DEFAULT_ACCOUNT_TYPE,
    signatureHex,
    publicKeyHex,
    accountKeys,
    authProof: {
      scheme: DEFAULT_SIGNATURE_SCHEME,
      public_key: `0x${publicKeyHex}`,
      signature: `0x${signatureHex}`,
      key_id: "primary",
    },
  };
}

export function publicKeyHexFromSeed(seed32: Uint8Array): string {
  return Buffer.from(ed.getPublicKey(seed32)).toString("hex");
}

export function addressHexFromSeed(seed32: Uint8Array): string {
  return `0x${publicKeyHexFromSeed(seed32)}`;
}

/** 32-byte Ed25519 seed from 64 hex chars（privateKey） */
export function seedFromHex64(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("privateKey must be 64 hex chars (32-byte Ed25519 seed)");
  }
  return Uint8Array.from(Buffer.from(clean, "hex"));
}
