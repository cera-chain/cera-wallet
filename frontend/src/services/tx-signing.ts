import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import type { WalletSummary } from "../types/api";
import {
  isLegacyHexAddress,
  legacyHexToCeraAddress,
  normalizeAddressForChain
} from "../utils/cera-address";

ed.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed.etc.concatBytes(...messages));

export const DEFAULT_SIGNATURE_SCHEME = "ed25519" as const;
export const POST_QUANTUM_SIGNATURE_SCHEME = "mldsa" as const;
export const DEFAULT_ACCOUNT_TYPE = "legacy_ed25519" as const;
export const HYBRID_ACCOUNT_TYPE = "hybrid_ed25519_mldsa" as const;

export type AccountType =
  | typeof DEFAULT_ACCOUNT_TYPE
  | typeof HYBRID_ACCOUNT_TYPE
  | "pq_mldsa";

export type AuthMode = "single" | "hybrid";

export type AccountKeyRef = {
  scheme: string;
  public_key: string;
  key_id: string;
};

export type AuthenticationProofRef = {
  scheme: typeof DEFAULT_SIGNATURE_SCHEME | typeof POST_QUANTUM_SIGNATURE_SCHEME;
  public_key: string;
  signature: string;
  key_id: string;
};

export type StakingActionRef = {
  kind: string;
  validator_address?: string;
  consensus_public_key?: string;
};

export type SignedTransactionPayload = {
  from: string;
  to: string;
  value: string | number;
  fee: string | number;
  nonce: number;
  signature: string;
  public_key: string;
  signature_scheme: typeof DEFAULT_SIGNATURE_SCHEME;
  auth_proofs: AuthenticationProofRef[];
  auth_mode: AuthMode;
  from_address_type: "legacy_hex" | "legacy_named";
  account_type: AccountType;
  account_keys: AccountKeyRef[];
  staking?: StakingActionRef;
};

type UnsignedTransaction = {
  from: string;
  to: string;
  amount: bigint;
  nonce: bigint;
  fee: bigint;
  staking?: StakingActionRef;
};

function withHexPrefix(value: string) {
  return value.toLowerCase().startsWith("0x") ? value : `0x${value}`;
}

function normalizeAddress(address: string): string {
  return normalizeAddressForChain(address);
}

function inferAddressType(address: string): "legacy_hex" | "legacy_named" {
  return isLegacyHexAddress(address) ? "legacy_hex" : "legacy_named";
}

function concatBytes(...items: Uint8Array[]): Uint8Array {
  const length = items.reduce((total, item) => total + item.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const item of items) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

function u64Be(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError("u64 out of range");
  }
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, false);
  return out;
}

function transactionIdHashBytes(tx: UnsignedTransaction): Uint8Array {
  const parts = [
    utf8ToBytes(tx.from),
    utf8ToBytes(tx.to),
    u64Be(tx.amount),
    u64Be(tx.nonce),
    u64Be(tx.fee)
  ];

  if (tx.staking) {
    parts.push(utf8ToBytes(tx.staking.kind));
    parts.push(utf8ToBytes(tx.staking.validator_address ?? ""));
    parts.push(utf8ToBytes(tx.staking.consensus_public_key ?? ""));
  }

  parts.push(new Uint8Array([0]));
  return sha256(concatBytes(...parts));
}

export function parseAmountString(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid amount string: ${value}`);
  }
  return BigInt(normalized);
}

function rpcAmountField(value: bigint): string | number {
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
}

function seedFromPrivateKey(privateKey: string): Uint8Array {
  const clean = privateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("privateKey must be 64 hex chars (32-byte Ed25519 seed)");
  }
  return hexToBytes(clean);
}

function addressFromSeed(seed: Uint8Array): string {
  return legacyHexToCeraAddress(`0x${bytesToHex(ed.getPublicKey(seed))}`);
}

export function deriveAddressFromPrivateKey(privateKey: string): string {
  return addressFromSeed(seedFromPrivateKey(privateKey));
}

function accountTypeFromSummary(summary: WalletSummary): AccountType {
  if (summary.account_type === HYBRID_ACCOUNT_TYPE || summary.account_type === "pq_mldsa") {
    return summary.account_type;
  }
  return DEFAULT_ACCOUNT_TYPE;
}

function authModeFromSummary(summary: WalletSummary): AuthMode {
  return summary.account_auth_mode === "hybrid" ? "hybrid" : "single";
}

function ensureSenderMatchesPrivateKey(requestedFrom: string | undefined, derivedAddress: string): string {
  const normalizedFrom = requestedFrom ? normalizeAddressForChain(requestedFrom) : "";
  const derivedChainAddress = normalizeAddressForChain(derivedAddress);
  if (normalizedFrom && isLegacyHexAddress(normalizedFrom) && normalizedFrom.toLowerCase() !== derivedChainAddress.toLowerCase()) {
    throw new Error(`FROM_MISMATCH: provided from ${normalizedFrom} does not match privateKey-derived address ${derivedAddress}`);
  }
  return normalizedFrom || derivedChainAddress;
}

function createMldsaProof(message: Uint8Array, pqPrivateKey: string): {
  proof: AuthenticationProofRef;
  key: AccountKeyRef;
} {
  const clean = pqPrivateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("pqPrivateKey must be 64 hex chars (32-byte ML-DSA seed)");
  }
  const { secretKey, publicKey } = ml_dsa65.keygen(hexToBytes(clean));
  const publicKeyHex = bytesToHex(publicKey);
  const signatureHex = bytesToHex(ml_dsa65.sign(message, secretKey));
  return {
    proof: {
      scheme: POST_QUANTUM_SIGNATURE_SCHEME,
      public_key: `0x${publicKeyHex}`,
      signature: `0x${signatureHex}`,
      key_id: "pq-primary"
    },
    key: {
      scheme: POST_QUANTUM_SIGNATURE_SCHEME,
      public_key: `0x${publicKeyHex}`,
      key_id: "pq-primary"
    }
  };
}

export async function signTransaction(params: {
  from?: string;
  to: string;
  amount: string;
  fee?: string;
  nonce?: number;
  privateKey: string;
  pqPrivateKey?: string;
  summary: WalletSummary;
  staking?: StakingActionRef;
}): Promise<SignedTransactionPayload> {
  const fee = params.fee?.trim() || "1";
  const amountBi = parseAmountString(params.amount);
  const feeBi = parseAmountString(fee);
  const seed = seedFromPrivateKey(params.privateKey);
  const derivedAddress = addressFromSeed(seed);
  const effectiveFrom = ensureSenderMatchesPrivateKey(params.from, derivedAddress);
  const normalizedTo = normalizeAddressForChain(params.to);
  const normalizedStaking = params.staking
    ? {
        ...params.staking,
        validator_address: params.staking.validator_address
          ? normalizeAddressForChain(params.staking.validator_address)
          : undefined,
        consensus_public_key: params.staking.consensus_public_key
          ? normalizeAddressForChain(params.staking.consensus_public_key)
          : undefined
      }
    : undefined;
  const accountType = accountTypeFromSummary(params.summary);
  const authMode = authModeFromSummary(params.summary);

  if (accountType === "pq_mldsa") {
    throw new Error("PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET: wallet signer does not yet support pq_mldsa-only submissions");
  }

  const nonce = params.nonce ?? params.summary.next_nonce;
  if (!Number.isInteger(nonce) || nonce < 0) {
    throw new Error("nonce must be a non-negative integer");
  }

  const unsigned: UnsignedTransaction = {
    from: effectiveFrom,
    to: normalizedTo,
    amount: amountBi,
    nonce: BigInt(nonce),
    fee: feeBi,
    staking: normalizedStaking
  };
  const message = transactionIdHashBytes(unsigned);
  const signatureHex = bytesToHex(ed.sign(message, seed));
  const publicKeyHex = bytesToHex(ed.getPublicKey(seed));
  const legacyProof: AuthenticationProofRef = {
    scheme: DEFAULT_SIGNATURE_SCHEME,
    public_key: `0x${publicKeyHex}`,
    signature: `0x${signatureHex}`,
    key_id: "primary"
  };
  const accountKeys: AccountKeyRef[] = [
    {
      scheme: DEFAULT_SIGNATURE_SCHEME,
      public_key: `0x${publicKeyHex}`,
      key_id: "primary"
    }
  ];
  const authProofs = [legacyProof];

  if (accountType === HYBRID_ACCOUNT_TYPE) {
    if (!params.pqPrivateKey) {
      throw new Error(`HYBRID_PQ_SEED_REQUIRED: account requires ${HYBRID_ACCOUNT_TYPE} signing but pqPrivateKey was not provided`);
    }
    const pq = createMldsaProof(message, params.pqPrivateKey);
    authProofs.push(pq.proof);
    accountKeys.push(pq.key);
  }

  return {
    from: effectiveFrom,
    to: normalizedTo,
    value: rpcAmountField(amountBi),
    fee: rpcAmountField(feeBi),
    nonce,
    signature: withHexPrefix(signatureHex),
    public_key: `0x${publicKeyHex}`,
    signature_scheme: DEFAULT_SIGNATURE_SCHEME,
    auth_proofs: authProofs,
    auth_mode: accountType === HYBRID_ACCOUNT_TYPE ? "hybrid" : authMode,
    from_address_type: inferAddressType(effectiveFrom),
    account_type: accountType,
    account_keys: accountKeys,
    ...(normalizedStaking ? { staking: normalizedStaking } : {})
  };
}
