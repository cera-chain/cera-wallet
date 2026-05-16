import type { Receipt, SendTxResponse, StakingAction, TxStatusResponse } from "../types/api";
import { getJson, postJson } from "./http";
import { getWalletSummary } from "./wallet";
import {
  deriveAddressFromPrivateKey,
  signTransaction,
  type SignedTransactionPayload,
  type StakingActionRef
} from "./tx-signing";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3000";

export type SendTxPayload = {
  from?: string;
  to: string;
  amount: string;
  fee?: string;
  privateKey: string;
  nonce?: number;
};

export type BaseStakingPayload = {
  from?: string;
  privateKey: string;
  pqPrivateKey?: string;
  fee?: string;
  nonce?: number;
};

export type StakingRegisterPayload = BaseStakingPayload & {
  consensusPublicKey?: string;
};

export type StakingBondPayload = BaseStakingPayload & {
  validatorAddress: string;
  amount: string;
};

export type StakingUnbondPayload = BaseStakingPayload & {
  validatorAddress: string;
};

export type StakingUnbondFinalizePayload = BaseStakingPayload & {
  validatorAddress: string;
};

export type StakingRewardClaimPayload = BaseStakingPayload & {
  validatorAddress: string;
};

export type StakingPayloadMap = {
  validator_register: StakingRegisterPayload;
  stake_bond: StakingBondPayload;
  stake_unbond: StakingUnbondPayload;
  stake_unbond_finalize: StakingUnbondFinalizePayload;
  stake_reward_claim: StakingRewardClaimPayload;
};

function signerAddress(payload: { from?: string; privateKey: string }) {
  return payload.from?.trim() || deriveAddressFromPrivateKey(payload.privateKey);
}

async function signWithFreshSummary(payload: SendTxPayload, staking?: StakingActionRef): Promise<SignedTransactionPayload> {
  const signingSummary = await getWalletSummary(signerAddress(payload));
  return signTransaction({
    ...payload,
    summary: signingSummary,
    staking
  });
}

export async function sendTransaction(payload: SendTxPayload) {
  const signed = await signWithFreshSummary(payload);
  return postJson<SendTxResponse>(`${API_BASE}/api/tx/send`, signed, "tx.send");
}

export async function sendStakingRegister(payload: StakingRegisterPayload) {
  const from = signerAddress(payload);
  const consensusPublicKey = payload.consensusPublicKey?.trim() || from;
  const signed = await signWithFreshSummary(
    {
      ...payload,
      from,
      to: from,
      amount: "0"
    },
    {
      kind: "validator_register",
      consensus_public_key: consensusPublicKey
    }
  );
  return postJson<SendTxResponse>(
    `${API_BASE}/api/tx/staking/register`,
    signed,
    "tx.staking.register"
  );
}

export async function sendStakeBond(payload: StakingBondPayload) {
  const validatorAddress = payload.validatorAddress.trim();
  const signed = await signWithFreshSummary(
    {
      ...payload,
      to: validatorAddress
    },
    {
      kind: "stake_bond",
      validator_address: validatorAddress
    }
  );
  return postJson<SendTxResponse>(`${API_BASE}/api/tx/staking/bond`, signed, "tx.staking.bond");
}

export async function sendStakeUnbond(payload: StakingUnbondPayload) {
  const validatorAddress = payload.validatorAddress.trim();
  const signed = await signWithFreshSummary(
    {
      ...payload,
      to: validatorAddress,
      amount: "0"
    },
    {
      kind: "stake_unbond",
      validator_address: validatorAddress
    }
  );
  return postJson<SendTxResponse>(
    `${API_BASE}/api/tx/staking/unbond`,
    signed,
    "tx.staking.unbond"
  );
}

export async function sendStakeUnbondFinalize(payload: StakingUnbondFinalizePayload) {
  const validatorAddress = payload.validatorAddress.trim();
  const from = signerAddress(payload);
  const signed = await signWithFreshSummary(
    {
      ...payload,
      from,
      to: from,
      amount: "0"
    },
    {
      kind: "stake_unbond_finalize",
      validator_address: validatorAddress
    }
  );
  return postJson<SendTxResponse>(
    `${API_BASE}/api/tx/staking/unbond-finalize`,
    signed,
    "tx.staking.unbondFinalize"
  );
}

export async function sendStakeRewardClaim(payload: StakingRewardClaimPayload) {
  const validatorAddress = payload.validatorAddress.trim();
  const from = signerAddress(payload);
  const signed = await signWithFreshSummary(
    {
      ...payload,
      from,
      to: from,
      amount: "0"
    },
    {
      kind: "stake_reward_claim",
      validator_address: validatorAddress
    }
  );
  return postJson<SendTxResponse>(
    `${API_BASE}/api/tx/staking/reward-claim`,
    signed,
    "tx.staking.rewardClaim"
  );
}

export async function sendStakingTransaction<TAction extends StakingAction>(
  action: TAction,
  payload: StakingPayloadMap[TAction]
) {
  switch (action) {
    case "validator_register":
      return sendStakingRegister(payload as StakingRegisterPayload);
    case "stake_bond":
      return sendStakeBond(payload as StakingBondPayload);
    case "stake_unbond":
      return sendStakeUnbond(payload as StakingUnbondPayload);
    case "stake_unbond_finalize":
      return sendStakeUnbondFinalize(payload as StakingUnbondFinalizePayload);
    case "stake_reward_claim":
      return sendStakeRewardClaim(payload as StakingRewardClaimPayload);
    default:
      throw new Error(`Unsupported staking action: ${String(action)}`);
  }
}

export function getTxStatus(txHash: string) {
  return getJson<TxStatusResponse>(
    `${API_BASE}/api/tx/status?tx_hash=${encodeURIComponent(txHash)}`,
    "tx.status"
  );
}

export function getReceipt(txHash: string) {
  return getJson<Receipt>(
    `${API_BASE}/api/tx/receipt?tx_hash=${encodeURIComponent(txHash)}`,
    "tx.receipt"
  );
}
