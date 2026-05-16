import type {
  CheckpointsResponse,
  ForkChoiceStatus,
  HealthResponse,
  CreateWalletResponse,
  ImportPrivateKeyWalletResponse,
  ImportMnemonicWalletResponse,
  RegisterWalletResponse,
  LatestFinalizedCheckpoint,
  PendingListResponse,
  StakingPolicy,
  StakesResponse,
  ValidatorResponse,
  ValidatorSetResponse,
  WalletSummary
} from "../types/api";
import { getJson, postJson } from "./http";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3000";

export function getWalletSummary(address: string) {
  return getJson<WalletSummary>(
    `${API_BASE}/api/wallet/summary?address=${encodeURIComponent(address)}`,
    "wallet.summary"
  );
}

export function getHealth() {
  return getJson<HealthResponse>(`${API_BASE}/api/health`, "wallet.health");
}

export function createWalletAccount(payload: { keyMaterialRef?: string } = {}) {
  return postJson<CreateWalletResponse>(
    `${API_BASE}/api/wallet/account/create`,
    payload,
    "wallet.account.create"
  );
}

export function importPrivateKeyWalletAccount(payload: {
  privateKey: string;
  keyMaterialRef?: string;
}) {
  return postJson<ImportPrivateKeyWalletResponse>(
    `${API_BASE}/api/wallet/account/import-private-key`,
    payload,
    "wallet.account.import_private_key"
  );
}

export function importMnemonicWalletAccount(payload: {
  mnemonic: string;
  keyMaterialRef?: string;
}) {
  return postJson<ImportMnemonicWalletResponse>(
    `${API_BASE}/api/wallet/account/import-mnemonic`,
    payload,
    "wallet.account.import_mnemonic"
  );
}

export function registerWalletAccount(payload: {
  ceraAddress: string;
  accountType?: string;
  authMode?: string;
  ed25519PublicKey?: string;
  keyMaterialRef?: string;
  derivationScheme?: string;
  derivationPath?: string;
  coinType?: number;
  accountIndex?: number;
  addressIndex?: number;
}) {
  return postJson<RegisterWalletResponse>(
    `${API_BASE}/api/wallet/account/register-wallet`,
    payload,
    "wallet.account.register_wallet"
  );
}

export function getForkChoiceStatus() {
  return getJson<ForkChoiceStatus>(
    `${API_BASE}/api/system/fork-choice-status`,
    "wallet.fork_choice_status"
  );
}

export function getValidatorSet() {
  return getJson<ValidatorSetResponse>(
    `${API_BASE}/api/system/validator-set`,
    "wallet.validator_set"
  );
}

export function getValidator(address: string) {
  return getJson<ValidatorResponse>(
    `${API_BASE}/api/system/validator?address=${encodeURIComponent(address)}`,
    "wallet.validator"
  );
}

export function getStakes(params: {
  validator_address?: string;
  staker_address?: string;
  limit?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.validator_address) {
    query.set("validator_address", params.validator_address);
  }
  if (params.staker_address) {
    query.set("staker_address", params.staker_address);
  }
  if (typeof params.limit === "number") {
    query.set("limit", String(params.limit));
  }

  const suffix = query.toString();
  return getJson<StakesResponse>(
    `${API_BASE}/api/system/stakes${suffix ? `?${suffix}` : ""}`,
    "wallet.stakes"
  );
}

export function getStakingPolicy() {
  return getJson<StakingPolicy>(
    `${API_BASE}/api/system/staking-policy`,
    "wallet.staking_policy"
  );
}

export function getCheckpoints(limit = 12) {
  return getJson<CheckpointsResponse>(
    `${API_BASE}/api/system/checkpoints?limit=${encodeURIComponent(String(limit))}`,
    "wallet.checkpoints"
  );
}

export function getLatestFinalizedCheckpoint() {
  return getJson<LatestFinalizedCheckpoint>(
    `${API_BASE}/api/system/finalized`,
    "wallet.finalized"
  );
}

export async function getPendingTransactions(address: string) {
  const response = await getJson<PendingListResponse>(
    `${API_BASE}/api/wallet/pending?address=${encodeURIComponent(address)}`,
    "wallet.pending"
  );

  return [...response.pending].sort((a, b) => a.nonce - b.nonce);
}

export function getApiBaseUrl() {
  return API_BASE;
}
