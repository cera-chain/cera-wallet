import type { RpcClient } from "../rpc/client.js";
import type {
  CheckpointsRpc,
  ForkChoiceStatusRpc,
  GetValidatorRpc,
  LatestFinalizedCheckpointRpc,
  StakingPolicyRpc,
  StakesRpc,
  ValidatorSetRpc,
  WalletSummaryResult
} from "../rpc/types.js";
import { createRawRpcMethods } from "../rpc/methods.js";
import { normalizeAddressForChain, toDisplayAddress } from "../utils/address.js";

/**
 * 钱包业务层：在 **原始 RPC**（`createRawRpcMethods`）之上做字段裁剪、命名，不写第二遍 `method` 字符串。
 */
export function createWalletService(rpc: RpcClient) {
  const raw = createRawRpcMethods(rpc);

  return {
    getWalletSummary: (address: string): Promise<WalletSummaryResult> =>
      raw.getWalletSummary(normalizeAddressForChain(address)),

    /** 展示用：余额/nonce 以链节点为准，本地不要重算；客户端预检查只用于减少明显失败请求。 */
    async getBalanceView(address: string) {
      const chainAddress = normalizeAddressForChain(address);
      const data = await raw.getWalletSummary(chainAddress);
      return {
        address: toDisplayAddress(data.address),
        legacy_address: chainAddress,
        balance: data.balance,
        available: data.available,
        pending_out: data.pending_out,
        pending_in: data.pending_in,
        locked_balance: data.locked_balance,
        next_nonce: data.next_nonce,
        block_height: data.block_height,
        account_auth_mode: data.account_auth_mode ?? "single",
        account_type: data.account_type ?? "legacy_ed25519",
        account_key_count: data.account_key_count ?? 0,
        pq_key_count: data.pq_key_count ?? 0,
      };
    },

    /** 下一笔 nonce：必须用 RPC，禁止本地 +1；chain 是唯一权威来源。 */
    async getNextNonce(address: string): Promise<number> {
      const data = await raw.getWalletSummary(normalizeAddressForChain(address));
      return data.next_nonce;
    },

    getPendingTransactions: (address: string) => raw.getPendingTransactions(normalizeAddressForChain(address)),

    /** 调试/诊断状态优先由钱包后端透传，避免前端自己维护第二个 chain RPC base。 */
    getForkChoiceStatus: (): Promise<ForkChoiceStatusRpc> => raw.getForkChoiceStatus(),

    getValidatorSet: (): Promise<ValidatorSetRpc> => raw.getValidatorSet(),

    getValidator: (address: string): Promise<GetValidatorRpc> => raw.getValidator(normalizeAddressForChain(address)),

    getStakes: (params: {
      validator_address?: string;
      staker_address?: string;
      limit?: number;
    } = {}): Promise<StakesRpc> =>
      raw.getStakes({
        ...params,
        validator_address: params.validator_address
          ? normalizeAddressForChain(params.validator_address)
          : undefined,
        staker_address: params.staker_address
          ? normalizeAddressForChain(params.staker_address)
          : undefined,
      }),

    getStakingPolicy: (): Promise<StakingPolicyRpc> => raw.getStakingPolicy(),

    getCheckpoints: (limit = 20): Promise<CheckpointsRpc> => raw.getCheckpoints(limit),

    getLatestFinalizedCheckpoint: (): Promise<LatestFinalizedCheckpointRpc> =>
      raw.getLatestFinalizedCheckpoint(),
  };
}

export type WalletService = ReturnType<typeof createWalletService>;
