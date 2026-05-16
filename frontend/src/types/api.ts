export type MempoolStatus = "pending" | "future";

export type WalletSummary = {
  address: string;
  legacy_address?: string;
  balance: string;
  available: string;
  pending_out: string;
  pending_in: string;
  locked_balance: string;
  next_nonce: number;
  block_height: number | null;
  account_auth_mode: string;
  account_type: string;
  account_key_count: number;
  pq_key_count: number;
};

export type WalletAccountProfile = {
  ceraAddress: string;
  accountType: string;
  authMode: string;
  ed25519PublicKey: string | null;
  pqPublicKey: string | null;
  pqKeyId: string;
  keyMaterialRef: string | null;
  pqKeyMaterialRef: string | null;
  migrationVersion: number;
  derivationScheme: string | null;
  derivationPath: string | null;
  coinType: number | null;
  accountIndex: number | null;
  addressIndex: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWalletResponse = {
  address: string;
  legacyAddress?: string;
  publicKey: string;
  privateKey: string;
  account: WalletAccountProfile | null;
  privateKeyReturnedOnce: true;
};

export type CreateMnemonicWalletResponse = {
  address: string;
  legacyAddress?: string;
  publicKey: string;
  privateKey: string;
  mnemonic: string;
  mnemonicWordCount: 24;
  derivationScheme: string;
  derivationPath: string;
  account: WalletAccountProfile | null;
  secretsReturnedOnce: true;
};

export type ImportPrivateKeyWalletResponse = {
  address: string;
  legacyAddress?: string;
  publicKey: string;
  account: WalletAccountProfile | null;
};

export type ImportMnemonicWalletResponse = {
  address: string;
  legacyAddress?: string;
  publicKey: string;
  derivationScheme: string;
  derivationPath: string;
  account: WalletAccountProfile | null;
};

export type RegisterWalletResponse = WalletAccountProfile;

export type SendTxResponse = {
  tx_hash: string;
  mempool_status: MempoolStatus;
};

export type StakingAction =
  | "validator_register"
  | "stake_bond"
  | "stake_unbond"
  | "stake_unbond_finalize"
  | "stake_reward_claim";

export type PendingTxItem = {
  hash: string;
  nonce: number;
  to: string;
  value: string;
  fee: string;
  status: MempoolStatus;
  mempool_status: MempoolStatus;
  deprecated_status?: string;
};

export type Receipt = {
  tx_hash: string;
  block_height: number;
  status: string;
  from: string;
  to: string;
  amount: number;
  gas_used: number;
  logs: string[];
};

export type TxStatusResponse = {
  tx_hash: string;
  status: "pending" | "included" | "confirmed" | "not_found";
};

export type ApiError = {
  code: string;
  message: string;
};

export type PendingListResponse = {
  address: string;
  pending: PendingTxItem[];
};

export type HealthResponse = {
  ok: boolean;
  service: string;
};

export type ForkChoiceStatus = {
  scope: "fork_choice";
  tip_height: number;
  side_branch_tips: number;
  best_side_branch_tip_hash: string | null;
  best_side_branch_tip_height: number | null;
  best_side_branch_tip_state_root: string | null;
  advancing_side_branch_tips: number;
  compatible_advancing_tips: number;
  finalized_lock_filtered_tips: number;
  readiness_best_candidate_hash: string | null;
  readiness_best_candidate_height: number | null;
  promotion_attempts: number;
  promotion_successes: number;
  last_promotion_outcome: string | null;
  last_promotion_result_kind: string | null;
  last_promotion_reason_code: string | null;
  last_promotion_candidate_hash: string | null;
  last_promotion_candidate_height: number | null;
  effective_staking_policy_ref?: {
    source: string;
    policy_key: string;
    reward_activation_start: string;
  } | null;
};

export type ValidatorSetEntry = {
  validator_address: string;
  voting_power: string | number;
  effective_stake_base_units: string | number;
  active_from_height: number;
};

export type ValidatorSetResponse = {
  validator_set: ValidatorSetEntry[];
  count: number;
};

export type ValidatorRecord = {
  validator_address: string;
  consensus_public_key: string;
  status: string;
  metadata_version: number;
};

export type ValidatorResponse =
  | {
      found: true;
      validator: ValidatorRecord;
      validator_set_entry: ValidatorSetEntry | null;
      bonded_total_base_units: string;
      stake_count: number;
    }
  | {
      found: false;
    };

export type StakePosition = {
  staker_address: string;
  validator_address: string;
  bonded_amount_base_units: string | number;
  status: string;
  activated_height: number | null;
  unlock_requested_height: number | null;
  reward_cursor_progress_height: number | null;
  pending_reward_display_units: string | number;
};

export type StakesResponse = {
  stakes: StakePosition[];
  count: number;
  validator_address: string | null;
  staker_address: string | null;
  latest_progress_height: number;
};

export type StakingPolicy = {
  token_symbol: string;
  token_decimals: number;
  mainnet_chain_id: string;
  min_unbonding_checkpoint_delay: number;
  reward_per_progress_height_display_units: number;
  reward_stake_unit_display_units: number;
  reward_min_progress_heights: number;
  reward_requires_active_validator_set: boolean;
  reward_activation_start: string;
};

export type CheckpointRecord = {
  checkpoint_height: number;
  block_hash: string;
  status: string;
  created_at_height: number;
};

export type CheckpointsResponse = {
  checkpoints: CheckpointRecord[];
  count: number;
  latest_checkpoint_height: number | null;
};

export type LatestFinalizedCheckpoint =
  | {
      found: true;
      checkpoint_height: number;
      block_hash: string;
      status: string;
      created_at_height: number;
    }
  | {
      found: false;
    };
