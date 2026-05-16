import type { RpcClient } from "./client.js";
import type {
  GetTransactionReceiptResult,
  GetTransactionResult,
  ForkChoiceStatusRpc,
  CheckpointsRpc,
  SendTransactionResult,
  StakingPolicyRpc,
  StakesRpc,
  StoredReceiptRpc,
  GetValidatorRpc,
  LatestFinalizedCheckpointRpc,
  ValidatorSetRpc,
  WalletSummaryResult,
} from "./types.js";

/**
 * `send_transaction` 的结构化参数：已签名的完整交易字段，或节点支持的其它形态（如 `raw_tx`）。
 * 常见字段：`from`, `to`, `value` | `amount`, `fee`, `nonce`, `signature`。
 */
export type SignedTransactionRpcParams = Record<string, unknown>;

/**
 * 原始 RPC 方法薄封装（无业务逻辑）。
 * 业务语义（nonce 重试、余额校验）在 `services/*`。
 */
export function createRawRpcMethods(rpc: RpcClient) {
  return {
    getWalletSummary: (address: string) =>
      rpc.call<WalletSummaryResult>("get_wallet_summary", { address }),

    /** `get_transaction`：params `hash` 或 `tx_hash`（节点均支持） */
    getTransaction: (hash: string) =>
      rpc.call<GetTransactionResult | null>("get_transaction", { hash }),

    /** `get_transaction_receipt`：params `hash` 或 `tx_hash`；未命中时返回 `{ found: false }` */
    getTransactionReceipt: (tx_hash: string) =>
      rpc.call<GetTransactionReceiptResult>("get_transaction_receipt", { tx_hash }),

    /** `get_receipt`：持久化回执（`data/receipts.json`）；未命中时返回 `{ found: false }` */
    getReceipt: (tx_hash: string) =>
      rpc.call<StoredReceiptRpc | { found: false }>("get_receipt", { tx_hash }),

    getBalance: (address: string) =>
      rpc.call<Record<string, unknown>>("get_balance", { address }),

    getNonce: (address: string) =>
      rpc.call<Record<string, unknown>>("get_nonce", { address }),

    /**
     * JSON-RPC：`send_transaction`
     * @param tx 完整签名交易对象（`params` 对象，与节点 `params_to_transaction` / `raw_tx` 约定一致）
     * @returns 业务层结果：`success` + `hash` 或 `success: false` + `error`（非顶层 jsonrpc error）
     */
    sendTransaction: (tx: SignedTransactionRpcParams): Promise<SendTransactionResult> =>
      rpc.callSendTransaction(tx),

    getPendingTransactions: (address: string) =>
      rpc.call<unknown[]>("get_pending_transactions", { address }),

    getForkChoiceStatus: () =>
      rpc.call<ForkChoiceStatusRpc>("get_fork_choice_status", {}),

    getValidatorSet: () =>
      rpc.call<ValidatorSetRpc>("get_validator_set", {}),

    getValidator: (address: string) =>
      rpc.call<GetValidatorRpc>("get_validator", { address }),

    getStakes: (params: {
      validator_address?: string;
      staker_address?: string;
      limit?: number;
    } = {}) =>
      rpc.call<StakesRpc>("get_stakes", params),

    getStakingPolicy: () =>
      rpc.call<StakingPolicyRpc>("get_staking_policy", {}),

    getCheckpoints: (limit = 20) =>
      rpc.call<CheckpointsRpc>("get_checkpoints", { limit }),

    getLatestFinalizedCheckpoint: () =>
      rpc.call<LatestFinalizedCheckpointRpc>("get_latest_finalized_checkpoint", {}),
  };
}
