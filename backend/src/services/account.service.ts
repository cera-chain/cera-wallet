import { randomBytes } from "node:crypto";
import type { RpcClient } from "../rpc/client.js";
import type { DatabasePool } from "../db/pool.js";
import type { AccountRecord } from "../models/account.model.js";
import {
  createPostgresAccountRepository,
  type AccountRepository,
} from "../repositories/account.repository.js";
import { createRawRpcMethods } from "../rpc/methods.js";
import {
  addressHexFromSeed,
  publicKeyHexFromSeed,
  seedFromHex64,
} from "./signer.js";
import {
  CERA_MNEMONIC_DERIVATION_PATH,
  CERA_MNEMONIC_DERIVATION_SCHEME,
  generateCeraMnemonic,
  privateKeyHexFromMnemonic,
} from "./mnemonic.js";
import { normalizeAddressForChain, toDisplayAddress } from "../utils/address.js";
import { legacyHexToCeraAddress } from "../utils/cera-address.js";
import type { WalletSummaryResult } from "../rpc/types.js";

export interface RegisterAccountInput {
  ceraAddress: string;
  keyMaterialRef?: string;
  pqKeyMaterialRef?: string;
  accountType?: string;
  authMode?: string;
  ed25519PublicKey?: string;
  pqPublicKey?: string;
  pqKeyId?: string;
  migrationVersion?: number;
  derivationScheme?: string;
  derivationPath?: string;
  coinType?: number;
  accountIndex?: number;
  addressIndex?: number;
}

export interface PrepareHybridMigrationInput {
  ceraAddress: string;
  pqPublicKey: string;
  pqKeyMaterialRef?: string;
  pqKeyId?: string;
}

export interface CreateWalletInput {
  keyMaterialRef?: string;
}

export interface ImportPrivateKeyWalletInput {
  privateKey: string;
  keyMaterialRef?: string;
}

export interface CreateMnemonicWalletInput {
  keyMaterialRef?: string;
}

export interface ImportMnemonicWalletInput {
  mnemonic: string;
  keyMaterialRef?: string;
}

function buildPostQuantumStatus(
  profile: ReturnType<typeof toProfile>,
  chainSummary: WalletSummaryResult | null
) {
  const localAccountType = profile?.accountType ?? "legacy_ed25519";
  const chainAccountType = chainSummary?.account_type ?? "legacy_ed25519";
  const chainAuthMode = chainSummary?.account_auth_mode ?? "single";
  const pqKeyCount = chainSummary?.pq_key_count ?? 0;
  const chainHybridActive =
    chainAccountType === "hybrid_ed25519_mldsa" && chainAuthMode === "hybrid";
  const migrationPreparedLocally =
    profile?.accountType === "hybrid_ed25519_mldsa" && Boolean(profile?.pqPublicKey);
  const migrationConfirmedOnChain = chainHybridActive && pqKeyCount > 0;

  const banner = migrationConfirmedOnChain
    ? {
        level: "success",
        message:
          "账户已完成链上 hybrid 迁移，后续交易必须使用 Ed25519 + ML-DSA 双签名提交。",
      }
    : migrationPreparedLocally
      ? {
          level: "warning",
          message:
            "本地已准备后量子密钥，但链上仍未切换到 hybrid。请尽快提交 migrate-hybrid 迁移交易。",
        }
      : {
          level: "info",
          message:
            "当前账户仍处于 legacy 模式，建议先准备 PQ 密钥并完成 hybrid 迁移。",
        };

  return {
    local_account_type: localAccountType,
    chain_account_type: chainAccountType,
    chain_auth_mode: chainAuthMode,
    local_pq_ready: Boolean(profile?.pqPublicKey),
    chain_hybrid_active: chainHybridActive,
    migration_prepared_locally: migrationPreparedLocally,
    migration_confirmed_on_chain: migrationConfirmedOnChain,
    pq_key_count: pqKeyCount,
    recommended_next_step:
      chainHybridActive
        ? "use hybrid transaction signing for subsequent submissions"
        : migrationPreparedLocally
          ? "submit on-chain hybrid migration transaction"
          : "register pq key material locally before migration",
    ui_banner_level: banner.level,
    ui_banner_message: banner.message,
  };
}

type PostQuantumStatus = ReturnType<typeof buildPostQuantumStatus>;

interface AccountProfileResult {
  account: ReturnType<typeof toProfile>;
  chainSummary: WalletSummaryResult | null;
  postQuantumStatus: PostQuantumStatus;
}

function toProfile(doc: AccountRecord | null) {
  if (!doc) return null;
  return {
    ceraAddress: doc.ceraAddress,
    accountType: doc.accountType ?? "legacy_ed25519",
    authMode: doc.authMode ?? "single",
    ed25519PublicKey: doc.ed25519PublicKey ?? null,
    pqPublicKey: doc.pqPublicKey ?? null,
    pqKeyId: doc.pqKeyId ?? "pq-primary",
    keyMaterialRef: doc.keyMaterialRef ?? null,
    pqKeyMaterialRef: doc.pqKeyMaterialRef ?? null,
    migrationVersion: doc.migrationVersion ?? 1,
    derivationScheme: doc.derivationScheme ?? null,
    derivationPath: doc.derivationPath ?? null,
    coinType: doc.coinType ?? null,
    accountIndex: doc.accountIndex ?? null,
    addressIndex: doc.addressIndex ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function cleanOptional(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const out = String(value).trim();
  return out.length > 0 ? out : undefined;
}

function buildAccountMetadata(input: {
  ceraAddress: string;
  publicKeyHex: string;
  keyMaterialRef?: string;
  derivationScheme?: string;
  derivationPath?: string;
  coinType?: number;
  accountIndex?: number;
  addressIndex?: number;
}) {
  return {
    ceraAddress: input.ceraAddress,
    accountType: "legacy_ed25519",
    authMode: "single",
    keyMaterialRef: cleanOptional(input.keyMaterialRef) ?? "client-held:ed25519",
    pqKeyMaterialRef: undefined,
    ed25519PublicKey: `0x${input.publicKeyHex}`,
    pqPublicKey: undefined,
    pqKeyId: "pq-primary",
    migrationVersion: 1,
    derivationScheme: input.derivationScheme,
    derivationPath: input.derivationPath,
    coinType: input.coinType,
    accountIndex: input.accountIndex,
    addressIndex: input.addressIndex,
  };
}

function deriveWalletFromPrivateKeyHex(privateKey: string) {
  const seed = seedFromHex64(privateKey);
  const publicKeyHex = publicKeyHexFromSeed(seed);
  const legacyAddress = addressHexFromSeed(seed);
  const ceraAddress = legacyHexToCeraAddress(legacyAddress);
  return { seed, publicKeyHex, ceraAddress, legacyAddress };
}

function ceraMnemonicDerivationMetadata() {
  return {
    derivationScheme: CERA_MNEMONIC_DERIVATION_SCHEME,
    derivationPath: CERA_MNEMONIC_DERIVATION_PATH,
    coinType: 68291,
    accountIndex: 0,
    addressIndex: 0,
  };
}

function requireAddress(input: {
  ceraAddress?: string;
}) {
  const ceraAddress = cleanOptional(input.ceraAddress);
  if (!ceraAddress) {
    throw new Error("ceraAddress is required");
  }
  return toDisplayAddress(ceraAddress);
}

async function findAccountByAddress(
  repository: AccountRepository,
  input: {
  ceraAddress?: string;
}) {
  return repository.findByAddress(requireAddress(input));
}

export function createAccountService(
  rpc: RpcClient,
  options: { database?: DatabasePool; repository?: AccountRepository } = {}
) {
  const raw = createRawRpcMethods(rpc);
  const repository =
    options.repository ??
    (options.database ? createPostgresAccountRepository(options.database) : null);

  function requireRepository(): AccountRepository {
    if (!repository) {
      throw new Error("DATABASE_URL is required for wallet account storage");
    }
    return repository;
  }

  async function getAccountProfileImpl(input: {
    ceraAddress?: string;
  }): Promise<AccountProfileResult> {
    const account = await findAccountByAddress(requireRepository(), input);
    const profile = toProfile(account);
    const address = profile?.ceraAddress ?? cleanOptional(input.ceraAddress);
    const chainSummary = address
      ? await raw.getWalletSummary(normalizeAddressForChain(address))
      : null;
    return {
      account: profile,
      chainSummary,
      postQuantumStatus: buildPostQuantumStatus(profile, chainSummary),
    };
  }

  return {
    async createWallet(input: CreateWalletInput = {}) {
      const privateKey = randomBytes(32).toString("hex");
      const { publicKeyHex, ceraAddress, legacyAddress } = deriveWalletFromPrivateKeyHex(privateKey);
      const account = repository
        ? await repository.upsertByAddress(
            buildAccountMetadata({
              ceraAddress,
              publicKeyHex,
              keyMaterialRef: input.keyMaterialRef,
            })
          )
        : null;

      return {
        address: ceraAddress,
        legacyAddress,
        publicKey: `0x${publicKeyHex}`,
        privateKey: `0x${privateKey}`,
        account: toProfile(account),
        privateKeyReturnedOnce: true,
      };
    },

    async createMnemonicWallet(input: CreateMnemonicWalletInput = {}) {
      const mnemonic = generateCeraMnemonic();
      const privateKey = privateKeyHexFromMnemonic(mnemonic);
      const { publicKeyHex, ceraAddress, legacyAddress } = deriveWalletFromPrivateKeyHex(privateKey);
      const account = repository
        ? await repository.upsertByAddress(
            buildAccountMetadata({
              ceraAddress,
              publicKeyHex,
              keyMaterialRef: input.keyMaterialRef ?? "client-held:bip39",
              ...ceraMnemonicDerivationMetadata(),
            })
          )
        : null;

      return {
        address: ceraAddress,
        legacyAddress,
        publicKey: `0x${publicKeyHex}`,
        privateKey: `0x${privateKey}`,
        mnemonic,
        mnemonicWordCount: 24,
        derivationScheme: CERA_MNEMONIC_DERIVATION_SCHEME,
        derivationPath: CERA_MNEMONIC_DERIVATION_PATH,
        account: toProfile(account),
        secretsReturnedOnce: true,
      };
    },

    async importPrivateKeyWallet(input: ImportPrivateKeyWalletInput) {
      const { publicKeyHex, ceraAddress, legacyAddress } = deriveWalletFromPrivateKeyHex(input.privateKey);
      const account = repository
        ? await repository.upsertByAddress(
            buildAccountMetadata({
              ceraAddress,
              publicKeyHex,
              keyMaterialRef: input.keyMaterialRef,
            })
          )
        : null;

      return {
        address: ceraAddress,
        legacyAddress,
        publicKey: `0x${publicKeyHex}`,
        account: toProfile(account),
      };
    },

    async importMnemonicWallet(input: ImportMnemonicWalletInput) {
      const privateKey = privateKeyHexFromMnemonic(input.mnemonic);
      const { publicKeyHex, ceraAddress, legacyAddress } = deriveWalletFromPrivateKeyHex(privateKey);
      const account = repository
        ? await repository.upsertByAddress(
            buildAccountMetadata({
              ceraAddress,
              publicKeyHex,
              keyMaterialRef: input.keyMaterialRef ?? "client-held:bip39",
              ...ceraMnemonicDerivationMetadata(),
            })
          )
        : null;

      return {
        address: ceraAddress,
        legacyAddress,
        publicKey: `0x${publicKeyHex}`,
        derivationScheme: CERA_MNEMONIC_DERIVATION_SCHEME,
        derivationPath: CERA_MNEMONIC_DERIVATION_PATH,
        account: toProfile(account),
      };
    },

    async registerAccount(input: RegisterAccountInput) {
      const ceraAddress = cleanOptional(input.ceraAddress);
      if (!ceraAddress) {
        throw new Error("ceraAddress is required");
      }

      const normalizedAddress = toDisplayAddress(ceraAddress);
      const update = {
        ceraAddress: normalizedAddress,
        accountType: cleanOptional(input.accountType) ?? "legacy_ed25519",
        authMode: cleanOptional(input.authMode) ?? "single",
        keyMaterialRef: cleanOptional(input.keyMaterialRef),
        pqKeyMaterialRef: cleanOptional(input.pqKeyMaterialRef),
        ed25519PublicKey: cleanOptional(input.ed25519PublicKey),
        pqPublicKey: cleanOptional(input.pqPublicKey),
        pqKeyId: cleanOptional(input.pqKeyId) ?? "pq-primary",
        migrationVersion: input.migrationVersion ?? 1,
        derivationScheme: cleanOptional(input.derivationScheme),
        derivationPath: cleanOptional(input.derivationPath),
        coinType: input.coinType,
        accountIndex: input.accountIndex,
        addressIndex: input.addressIndex,
        updatedAt: new Date(),
      };

      const doc = await requireRepository().upsertByAddress(update);

      return toProfile(doc);
    },

    async getAccountProfile(input: {
      ceraAddress?: string;
    }): Promise<AccountProfileResult> {
      return getAccountProfileImpl(input);
    },

    async prepareHybridMigration(input: PrepareHybridMigrationInput) {
      const pqPublicKey = cleanOptional(input.pqPublicKey);
      if (!pqPublicKey) {
        throw new Error("pqPublicKey is required");
      }
      const account = await findAccountByAddress(requireRepository(), input);
      if (!account) {
        throw new Error("account not found");
      }

      const updatedAccount = await requireRepository().updateHybridMigration({
        ceraAddress: account.ceraAddress,
        accountType: "hybrid_ed25519_mldsa",
        authMode: "hybrid",
        pqPublicKey,
        pqKeyMaterialRef: cleanOptional(input.pqKeyMaterialRef),
        pqKeyId: cleanOptional(input.pqKeyId) ?? "pq-primary",
        migrationVersion: Math.max((account.migrationVersion ?? 1) + 1, 2),
      });

      const chainSummary = await raw.getWalletSummary(normalizeAddressForChain(updatedAccount.ceraAddress));

      return {
        account: toProfile(updatedAccount),
        chainSummary,
        postQuantumStatus: buildPostQuantumStatus(toProfile(updatedAccount), chainSummary),
        migration: {
          prepared: true,
          target_account_type: "hybrid_ed25519_mldsa",
          target_auth_mode: "hybrid",
        },
      };
    },

    async getPostQuantumReadiness(input: {
      ceraAddress?: string;
    }): Promise<AccountProfileResult> {
      return getAccountProfileImpl(input);
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
