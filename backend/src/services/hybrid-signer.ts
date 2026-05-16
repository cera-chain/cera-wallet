import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { transactionIdHashBytes } from "../utils/txHash.js";
import {
  DEFAULT_ACCOUNT_TYPE,
  DEFAULT_SIGNATURE_SCHEME,
  signTransfer,
  type AccountKeyRef,
  type AccountType,
  type SignatureScheme,
  type UnsignedTransfer,
} from "./signer.js";

export const POST_QUANTUM_SIGNATURE_SCHEME = "mldsa" as const;
export const HYBRID_ACCOUNT_TYPE = "hybrid_ed25519_mldsa" as const;

export interface AuthenticationProofRef {
  scheme: SignatureScheme | typeof POST_QUANTUM_SIGNATURE_SCHEME;
  public_key: string;
  signature: string;
  key_id: string;
}

export interface TransferAuthBundle {
  signatureScheme: SignatureScheme;
  authMode: "single" | "hybrid";
  accountType: AccountType;
  signatureHex: string;
  publicKeyHex: string;
  accountKeys: AccountKeyRef[];
  authProof: AuthenticationProofRef;
  authProofs: AuthenticationProofRef[];
}

export interface HybridPqSigner {
  scheme: typeof POST_QUANTUM_SIGNATURE_SCHEME;
  publicKeyHex: string;
  keyId?: string;
  sign(message: Uint8Array): Uint8Array | Promise<Uint8Array>;
}

export interface SignTransferAccountOptions {
  authMode?: "single" | "hybrid";
  accountType?: AccountType;
  pqSigner?: HybridPqSigner;
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

export function mldsa65KeypairFromSeed(seed32: Uint8Array): {
  secretSeed: Uint8Array;
  secretKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyHex: string;
} {
  const { secretKey, publicKey } = ml_dsa65.keygen(seed32);
  return {
    secretSeed: seed32,
    secretKey,
    publicKey,
    publicKeyHex: Buffer.from(publicKey).toString("hex"),
  };
}

export function createMldsa65PqSigner(
  seed32: Uint8Array,
  keyId = "pq-primary"
): HybridPqSigner {
  const { secretKey, publicKeyHex } = mldsa65KeypairFromSeed(seed32);
  return {
    scheme: POST_QUANTUM_SIGNATURE_SCHEME,
    publicKeyHex,
    keyId,
    sign(message: Uint8Array): Uint8Array {
      return ml_dsa65.sign(message, secretKey);
    },
  };
}

export async function signTransferWithAccount(
  tx: UnsignedTransfer,
  ed25519Seed: Uint8Array,
  options: SignTransferAccountOptions = {}
): Promise<TransferAuthBundle> {
  const legacy = signTransfer(tx, ed25519Seed);
  const accountType = options.accountType ?? DEFAULT_ACCOUNT_TYPE;
  const authMode =
    options.authMode ??
    (accountType === HYBRID_ACCOUNT_TYPE ? "hybrid" : "single");

  const legacyProof: AuthenticationProofRef = {
    scheme: DEFAULT_SIGNATURE_SCHEME,
    public_key: legacy.authProof.public_key,
    signature: legacy.authProof.signature,
    key_id: legacy.authProof.key_id,
  };

  if (accountType === DEFAULT_ACCOUNT_TYPE) {
    return {
      signatureScheme: legacy.signatureScheme,
      authMode: "single",
      accountType,
      signatureHex: legacy.signatureHex,
      publicKeyHex: legacy.publicKeyHex,
      accountKeys: legacy.accountKeys,
      authProof: legacyProof,
      authProofs: [legacyProof],
    };
  }

  if (accountType === "pq_mldsa") {
    throw new Error(
      "PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET: wallet signer does not yet support pq_mldsa-only submissions"
    );
  }

  if (accountType !== HYBRID_ACCOUNT_TYPE) {
    throw new Error(`UNSUPPORTED_ACCOUNT_TYPE: ${accountType}`);
  }

  if (authMode !== "hybrid") {
    throw new Error(
      `INVALID_AUTH_MODE_FOR_HYBRID: hybrid_ed25519_mldsa requires authMode=hybrid, got ${authMode}`
    );
  }

  if (!options.pqSigner) {
    throw new Error(
      "HYBRID_PQ_SIGNER_REQUIRED: hybrid_ed25519_mldsa submissions require an ML-DSA signer"
    );
  }

  const message = transactionIdHashBytes(txHashInput(tx));
  const pqSignature = await options.pqSigner.sign(message);
  const pqKeyId = options.pqSigner.keyId ?? "pq-primary";
  const pqProof: AuthenticationProofRef = {
    scheme: POST_QUANTUM_SIGNATURE_SCHEME,
    public_key: `0x${options.pqSigner.publicKeyHex}`,
    signature: `0x${Buffer.from(pqSignature).toString("hex")}`,
    key_id: pqKeyId,
  };

  return {
    signatureScheme: legacy.signatureScheme,
    authMode: "hybrid",
    accountType,
    signatureHex: legacy.signatureHex,
    publicKeyHex: legacy.publicKeyHex,
    accountKeys: [
      ...legacy.accountKeys,
      {
        scheme: POST_QUANTUM_SIGNATURE_SCHEME,
        public_key: `0x${options.pqSigner.publicKeyHex}`,
        key_id: pqKeyId,
      },
    ],
    authProof: legacyProof,
    authProofs: [legacyProof, pqProof],
  };
}
