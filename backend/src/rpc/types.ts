/** JSON-RPC 2.0 顶层错误 */
export interface JsonRpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: JsonRpcErrorBody;
}

/** send_transaction 业务结果（在 result 内，非顶层 error） */
export type SendTransactionResult =
  | { success: true; hash: string; mempool_status: "pending" | "future" }
  | {
      success: false;
      error: string;
      message?: string;
      expected_next_nonce?: number;
      available?: string;
      need?: string;
      chain_balance?: string;
      pending_out?: string;
      location?: string;
      hash?: string;
    };

export interface WalletSummaryResult {
  address: string;
  balance: string;
  pending_out: string;
  pending_in: string;
  available: string;
  locked_balance: string;
  nonce: number;
  next_nonce: number;
  chain_nonce: number;
  pending_max_nonce: number;
  block_height: number | null;
  account_auth_mode?: string;
  account_type?: string;
  account_key_count?: number;
  pq_key_count?: number;
}

export interface StoredReceiptRpc {
  found: true;
  tx_hash: string;
  block_height: number;
  block_number?: number;
  status: string;
  from: string;
  to: string;
  amount: number;
  gas_used: number;
  logs: string[];
}

export type GetTransactionReceiptResult =
  | {
      found: true;
      tx_hash: string;
      block_height: number;
      success: boolean;
    }
  | {
      found: false;
    };

export interface ReceiptNotFoundResult {
  found: false;
}

/** `get_transaction`：链上为 `status: included`，池内为 `pending`，未找到时 RPC 返回 `null` */
export interface GetTransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  fee: string;
  nonce: number;
  status?: string;
  block_hash?: string | null;
  block_height?: number | null;
  index_in_block?: number | null;
}

export interface ForkChoiceStatusRpc {
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
}

export interface ValidatorSetEntryRpc {
  validator_address: string;
  voting_power: string | number;
  effective_stake_base_units: string | number;
  active_from_height: number;
}

export interface ValidatorSetRpc {
  validator_set: ValidatorSetEntryRpc[];
  count: number;
}

export interface ValidatorRpc {
  found: true;
  validator: {
    validator_address: string;
    consensus_public_key: string;
    status: string;
    metadata_version: number;
  };
  validator_set_entry: ValidatorSetEntryRpc | null;
  bonded_total_base_units: string;
  stake_count: number;
}

export interface StakePositionRpc {
  staker_address: string;
  validator_address: string;
  bonded_amount_base_units: string | number;
  status: string;
  activated_height: number | null;
  unlock_requested_height: number | null;
  reward_cursor_progress_height: number | null;
  pending_reward_display_units: string | number;
}

export interface StakesRpc {
  stakes: StakePositionRpc[];
  count: number;
  validator_address: string | null;
  staker_address: string | null;
  latest_progress_height: number;
}

export interface StakingPolicyRpc {
  token_symbol: string;
  token_decimals: number;
  mainnet_chain_id: string;
  min_unbonding_checkpoint_delay: number;
  reward_per_progress_height_display_units: number;
  reward_stake_unit_display_units: number;
  reward_min_progress_heights: number;
  reward_requires_active_validator_set: boolean;
  reward_activation_start: string;
}

export interface CheckpointRecordRpc {
  checkpoint_height: number;
  block_hash: string;
  status: string;
  created_at_height: number;
}

export interface CheckpointsRpc {
  checkpoints: CheckpointRecordRpc[];
  count: number;
  latest_checkpoint_height: number | null;
}

export type LatestFinalizedCheckpointRpc =
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

export type GetValidatorRpc = ValidatorRpc | { found: false };
