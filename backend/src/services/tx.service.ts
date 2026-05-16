import type { RpcClient } from "../rpc/client.js";
import { RpcError } from "../rpc/client.js";
import type {
  ReceiptNotFoundResult,
  SendTransactionResult,
  StoredReceiptRpc,
} from "../rpc/types.js";
import { createRawRpcMethods } from "../rpc/methods.js";
import { inferAddressType, isLegacyHexAddress, normalizeAddressForChain } from "../utils/address.js";
import { parseAmountString } from "../utils/txHash.js";
import {
  addressHexFromSeed,
  DEFAULT_ACCOUNT_TYPE,
  seedFromHex64,
  type AccountType,
  type UnsignedTransfer,
} from "./signer.js";
import {
  createMldsa65PqSigner,
  HYBRID_ACCOUNT_TYPE,
  mldsa65KeypairFromSeed,
  signTransferWithAccount,
} from "./hybrid-signer.js";

export type TxChainStatus = "pending" | "included" | "confirmed" | "not_found";

export interface TxStatusResult {
  tx_hash: string;
  status: TxChainStatus;
}

export interface SendTxResult {
  tx_hash: string;
  mempool_status: "pending" | "future";
}

export interface SendHybridMigrationInput {
  from?: string;
  fee?: string;
  nonce?: number | string;
  targetMigrationVersion?: number;
}

function isPersistentReceipt(r: unknown): r is StoredReceiptRpc {
  if (r === null || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    o.found === true &&
    typeof o.tx_hash === "string" &&
    typeof o.block_height === "number"
  );
}

function isReceiptNotFoundResult(r: unknown): r is ReceiptNotFoundResult {
  if (r === null || typeof r !== "object") return false;
  return (r as Record<string, unknown>).found === false;
}

function isReceiptNotFoundError(error: unknown): boolean {
  return error instanceof RpcError && (error.code === -32004 || /receipt not found/i.test(error.message));
}

const MAX_NONCE_RETRIES = 3;
const LOG = "[tx.service]";

const NONCE_ERRORS = new Set(["ERR_NONCE_TOO_LOW", "ERR_NONCE_TOO_HIGH"]);

export interface SendTransferInput {
  from?: string;
  to: string;
  /** 十进制整数字符串，与链上最小单位一致 */
  amount: string;
  fee?: string;
  /** 可选；不传则由节点 `get_wallet_summary.next_nonce` 决定 */
  nonce?: number | string;
}

export interface SendStakingInput {
  from?: string;
  fee?: string;
  nonce?: number | string;
  amount?: string;
  validatorAddress?: string;
  consensusPublicKey?: string;
}

/**
 * 业务侧构造的交易对象（含审计时间戳）。
 * 注意：CERA 节点 `send_transaction` 还需要 `fee`、`signature`；链上 hash / `signer.signTransfer` 的 preimage **不含** `timestamp`，
 * 否则与 `Transaction::hash` 不一致。timestamp 仅用于日志、落库、排错。
 */
export interface SendTxPayload {
  from: string;
  fromAddressType: string;
  to: string;
  amount: string;
  nonce: number;
  timestamp: number;
  authMode: "single" | "hybrid";
  accountType: AccountType;
}

type StakingKind =
  | "validator_register"
  | "stake_bond"
  | "stake_unbond"
  | "stake_unbond_finalize"
  | "stake_reward_claim";

function rpcAmountField(amount: bigint): string | number {
  if (amount <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(amount);
  }
  return amount.toString();
}

function buildTxPayload(
  input: SendTransferInput,
  nextNonce: number,
  authMode: "single" | "hybrid",
  accountType: AccountType
): SendTxPayload {
  if (!input.from || !input.from.trim()) {
    throw new Error("from is required");
  }
  const normalizedFrom = normalizeAddressForChain(input.from);
  return {
    from: normalizedFrom,
    fromAddressType: inferAddressType(normalizedFrom),
    to: normalizeAddressForChain(input.to),
    amount: input.amount,
    nonce: nextNonce,
    timestamp: Date.now(),
    authMode,
    accountType,
  };
}

function buildStakingPlan(
  kind: StakingKind,
  input: SendStakingInput,
  effectiveFrom: string
): {
  to: string;
  amount: string;
  staking: {
    kind: StakingKind;
    validator_address?: string;
    consensus_public_key?: string;
  };
} {
  if (kind === "validator_register") {
    return {
      to: effectiveFrom,
      amount: "0",
      staking: {
        kind,
        consensus_public_key:
          input.consensusPublicKey && input.consensusPublicKey.trim()
            ? input.consensusPublicKey.trim()
            : effectiveFrom,
      },
    };
  }

  const validatorAddress = input.validatorAddress
    ? normalizeAddressForChain(input.validatorAddress)
    : "";
  if (!validatorAddress) {
    throw new TxInputError("VALIDATOR_ADDRESS_REQUIRED: validatorAddress is required");
  }

  if (kind === "stake_bond") {
    if (input.amount === undefined || String(input.amount).trim() === "") {
      throw new TxInputError("STAKE_AMOUNT_REQUIRED: amount is required");
    }
    return {
      to: validatorAddress,
      amount: String(input.amount).trim(),
      staking: {
        kind,
        validator_address: validatorAddress,
      },
    };
  }

  if (kind === "stake_unbond") {
    return {
      to: validatorAddress,
      amount: "0",
      staking: {
        kind,
        validator_address: validatorAddress,
      },
    };
  }

  if (kind === "stake_reward_claim") {
    return {
      to: effectiveFrom,
      amount: "0",
      staking: {
        kind,
        validator_address: validatorAddress,
      },
    };
  }

  return {
    to: effectiveFrom,
    amount: "0",
    staking: {
      kind,
      validator_address: validatorAddress,
    },
  };
}

export function createTxService(rpc: RpcClient) {
  const raw = createRawRpcMethods(rpc);

  /**
   * 实际发送逻辑：`raw.sendTransaction(tx)` → JSON-RPC **`send_transaction`**。
   * nonce 与可用余额的最终判定都以 chain 为准；钱包本地预检查仅用于减少明显失败请求。
   */
  async function sendTransferWithRetry(
    input: SendTransferInput,
    ed25519SeedHex: string,
    options?: {
      pqSeedHex?: string;
    }
  ): Promise<SendTxResult> {
    console.log(LOG, "sendTransferWithRetry enter", {
      from: input.from,
      to: input.to,
      amount: input.amount,
      fee: input.fee ?? "1",
      nonce: input.nonce,
      maxAttempts: MAX_NONCE_RETRIES,
    });

    const fee = input.fee ?? "1";
    const amountBi = parseAmountString(input.amount);
    const feeBi = parseAmountString(fee);
    const seed = seedFromHex64(ed25519SeedHex);
    const derivedAddress = addressHexFromSeed(seed);
    const requestedFrom = input.from ? normalizeAddressForChain(input.from) : undefined;

    if (requestedFrom && isLegacyHexAddress(requestedFrom)) {
      if (requestedFrom.toLowerCase() !== derivedAddress.toLowerCase()) {
        throw new TxInputError(
          `FROM_MISMATCH: provided from ${requestedFrom} does not match privateKey-derived address ${derivedAddress}`
        );
      }
    }

    const effectiveFrom =
      requestedFrom && requestedFrom.length > 0 ? requestedFrom : derivedAddress;

    let lastFailure: SendTransactionResult | undefined;

    try {
      for (let attempt = 0; attempt < MAX_NONCE_RETRIES; attempt++) {
        console.log(LOG, `attempt ${attempt + 1}/${MAX_NONCE_RETRIES} → RPC get_wallet_summary`, {
          address: effectiveFrom,
        });

        const summary = await raw.getWalletSummary(effectiveFrom);

        let finalNonce: number;
        if (input.nonce !== undefined && input.nonce !== null) {
          finalNonce = Number(input.nonce);
          console.log("🔥 [WALLET] using user nonce:", finalNonce);
        } else {
          finalNonce = summary.next_nonce;
          console.log("🔥 [WALLET] using auto nonce:", finalNonce);
        }

        console.log(LOG, "get_wallet_summary returned", {
          next_nonce: summary.next_nonce,
          final_nonce: finalNonce,
          available: summary.available,
          balance: summary.balance,
          account_auth_mode: summary.account_auth_mode,
          account_type: summary.account_type,
        });

        const summaryAuthMode =
          summary.account_auth_mode === "hybrid" ? "hybrid" : "single";
        const summaryAccountType =
          summary.account_type === "hybrid_ed25519_mldsa" ||
          summary.account_type === "pq_mldsa"
            ? (summary.account_type as AccountType)
            : DEFAULT_ACCOUNT_TYPE;

        if (summaryAccountType === "pq_mldsa") {
          throw new TxInputError(
            "PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET: wallet signer does not yet support pq_mldsa-only submissions"
          );
        }

        const available = parseAmountString(summary.available);
        const need = amountBi + feeBi;
        if (available < need) {
          throw new TxInputError(
            `INSUFFICIENT_BALANCE: available ${summary.available} < amount ${input.amount} + fee ${fee}`
          );
        }

        const txPayload = buildTxPayload(
          {
            ...input,
            from: effectiveFrom,
          },
          finalNonce,
          summaryAuthMode,
          summaryAccountType
        );

        const unsigned: UnsignedTransfer = {
          from: txPayload.from,
          to: txPayload.to,
          amount: amountBi,
          nonce: BigInt(txPayload.nonce),
          fee: feeBi,
        };

        const pqSigner =
          summaryAccountType === HYBRID_ACCOUNT_TYPE
            ? options?.pqSeedHex
              ? createMldsa65PqSigner(seedFromHex64(options.pqSeedHex))
              : null
            : undefined;

        if (summaryAccountType === HYBRID_ACCOUNT_TYPE && !pqSigner) {
          throw new TxInputError(
            `HYBRID_PQ_SEED_REQUIRED: account requires ${HYBRID_ACCOUNT_TYPE} signing but pqSeedHex was not provided`
          );
        }

        const auth = await signTransferWithAccount(unsigned, seed, {
          authMode: summaryAuthMode,
          accountType: summaryAccountType,
          pqSigner: pqSigner ?? undefined,
        });

        const params: Record<string, unknown> = {
          from: txPayload.from,
          to: txPayload.to,
          value: rpcAmountField(amountBi),
          fee: rpcAmountField(feeBi),
          nonce: txPayload.nonce,
          signature: `0x${auth.signatureHex}`,
          public_key: `0x${auth.publicKeyHex}`,
          signature_scheme: auth.signatureScheme,
          auth_proofs: auth.authProofs,
          auth_mode: auth.authMode,
          from_address_type: txPayload.fromAddressType,
          account_type: auth.accountType,
          account_keys: auth.accountKeys,
        };

        console.log(LOG, "tx constructed (business payload + rpc params)", {
          txPayload,
          rpc: {
            ...params,
            signature: `0x${auth.signatureHex.slice(0, 12)}…(${auth.signatureHex.length} hex chars)`,
            public_key: `0x${auth.publicKeyHex.slice(0, 12)}…(${auth.publicKeyHex.length} hex chars)`,
          },
        });

        console.log(LOG, "→ await raw.sendTransaction (JSON-RPC send_transaction) …");

        const result = await raw.sendTransaction(params);

        console.log(LOG, "← send_transaction returned", result);

        lastFailure = result;

        if (result.success) {
          console.log(LOG, "success tx_hash=", result.hash, "mempool_status=", result.mempool_status);
          return {
            tx_hash: result.hash,
            mempool_status: result.mempool_status ?? "pending",
          };
        }

        if (result.success === false && NONCE_ERRORS.has(result.error)) {
          if (input.nonce !== undefined && input.nonce !== null) {
            console.log(LOG, "nonce error with user-supplied nonce, no retry:", result.error);
            throw new TxSubmitError(result);
          }
          console.log(LOG, "nonce error, will retry after refresh:", result.error);
          continue;
        }

        throw new TxSubmitError(result);
      }

      throw new TxSubmitError(
        lastFailure ?? {
          success: false,
          error: "NONCE_RETRIES_EXHAUSTED",
          message: `Failed after ${MAX_NONCE_RETRIES} attempts`,
        }
      );
    } catch (err) {
      console.error(LOG, "sendTransferWithRetry failed", err);
      throw err;
    }
  }

  async function submitSignedTransaction(
    params: Record<string, unknown>
  ): Promise<SendTxResult> {
    if ("privateKey" in params || "pqPrivateKey" in params || "mnemonic" in params || "seed" in params) {
      throw new TxInputError(
        "CLIENT_SECRET_REJECTED: submit only signed transaction fields; private keys and mnemonics must stay in the browser"
      );
    }

    const normalizedParams = { ...params };
    if (typeof normalizedParams.from === "string") {
      const from = normalizeAddressForChain(normalizedParams.from);
      normalizedParams.from = from;
      normalizedParams.from_address_type = inferAddressType(from);
    }
    if (typeof normalizedParams.to === "string") {
      normalizedParams.to = normalizeAddressForChain(normalizedParams.to);
    }
    const staking = normalizedParams.staking;
    if (staking && typeof staking === "object") {
      const normalizedStaking = { ...(staking as Record<string, unknown>) };
      if (typeof normalizedStaking.validator_address === "string") {
        normalizedStaking.validator_address = normalizeAddressForChain(normalizedStaking.validator_address);
      }
      if (typeof normalizedStaking.consensus_public_key === "string") {
        normalizedStaking.consensus_public_key = normalizeAddressForChain(normalizedStaking.consensus_public_key);
      }
      normalizedParams.staking = normalizedStaking;
    }

    const result = await raw.sendTransaction(normalizedParams);
    if (result.success) {
      return {
        tx_hash: result.hash,
        mempool_status: result.mempool_status ?? "pending",
      };
    }

    throw new TxSubmitError(result);
  }

  async function sendStakingWithRetry(
    kind: StakingKind,
    input: SendStakingInput,
    ed25519SeedHex: string,
    options?: {
      pqSeedHex?: string;
    }
  ): Promise<SendTxResult> {
    const fee = input.fee ?? "1";
    const feeBi = parseAmountString(fee);
    const seed = seedFromHex64(ed25519SeedHex);
    const derivedAddress = addressHexFromSeed(seed);
    const requestedFrom = input.from ? normalizeAddressForChain(input.from) : undefined;

    if (requestedFrom && isLegacyHexAddress(requestedFrom)) {
      if (requestedFrom.toLowerCase() !== derivedAddress.toLowerCase()) {
        throw new TxInputError(
          `FROM_MISMATCH: provided from ${requestedFrom} does not match privateKey-derived address ${derivedAddress}`
        );
      }
    }

    const effectiveFrom =
      requestedFrom && requestedFrom.length > 0 ? requestedFrom : derivedAddress;

    let lastFailure: SendTransactionResult | undefined;

    for (let attempt = 0; attempt < MAX_NONCE_RETRIES; attempt++) {
      const summary = await raw.getWalletSummary(effectiveFrom);
      const finalNonce =
        input.nonce !== undefined && input.nonce !== null
          ? Number(input.nonce)
          : summary.next_nonce;

      const summaryAuthMode =
        summary.account_auth_mode === "hybrid" ? "hybrid" : "single";
      const summaryAccountType =
        summary.account_type === "hybrid_ed25519_mldsa" ||
        summary.account_type === "pq_mldsa"
          ? (summary.account_type as AccountType)
          : DEFAULT_ACCOUNT_TYPE;

      if (summaryAccountType === "pq_mldsa") {
        throw new TxInputError(
          "PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET: wallet signer does not yet support pq_mldsa-only submissions"
        );
      }

      const plan = buildStakingPlan(kind, input, effectiveFrom);
      const amountBi = parseAmountString(plan.amount);
      const available = parseAmountString(summary.available);
      const need = amountBi + feeBi;
      if (available < need) {
        throw new TxInputError(
          `INSUFFICIENT_BALANCE: available ${summary.available} < amount ${plan.amount} + fee ${fee}`
        );
      }

      const txPayload = buildTxPayload(
        {
          from: effectiveFrom,
          to: plan.to,
          amount: plan.amount,
          fee,
          nonce: finalNonce,
        },
        finalNonce,
        summaryAuthMode,
        summaryAccountType
      );

      const unsigned: UnsignedTransfer = {
        from: txPayload.from,
        to: txPayload.to,
        amount: amountBi,
        nonce: BigInt(txPayload.nonce),
        fee: feeBi,
        staking: plan.staking,
      };

      const pqSigner =
        summaryAccountType === HYBRID_ACCOUNT_TYPE
          ? options?.pqSeedHex
            ? createMldsa65PqSigner(seedFromHex64(options.pqSeedHex))
            : null
          : undefined;

      if (summaryAccountType === HYBRID_ACCOUNT_TYPE && !pqSigner) {
        throw new TxInputError(
          `HYBRID_PQ_SEED_REQUIRED: account requires ${HYBRID_ACCOUNT_TYPE} signing but pqSeedHex was not provided`
        );
      }

      const auth = await signTransferWithAccount(unsigned, seed, {
        authMode: summaryAuthMode,
        accountType: summaryAccountType,
        pqSigner: pqSigner ?? undefined,
      });

      const params: Record<string, unknown> = {
        from: txPayload.from,
        to: txPayload.to,
        value: rpcAmountField(amountBi),
        fee: rpcAmountField(feeBi),
        nonce: txPayload.nonce,
        signature: `0x${auth.signatureHex}`,
        public_key: `0x${auth.publicKeyHex}`,
        signature_scheme: auth.signatureScheme,
        auth_proofs: auth.authProofs,
        auth_mode: auth.authMode,
        from_address_type: txPayload.fromAddressType,
        account_type: auth.accountType,
        account_keys: auth.accountKeys,
        staking: plan.staking,
      };

      const result = await raw.sendTransaction(params);
      lastFailure = result;

      if (result.success) {
        return {
          tx_hash: result.hash,
          mempool_status: result.mempool_status ?? "pending",
        };
      }

      if (result.success === false && NONCE_ERRORS.has(result.error)) {
        if (input.nonce !== undefined && input.nonce !== null) {
          throw new TxSubmitError(result);
        }
        continue;
      }

      throw new TxSubmitError(result);
    }

    throw new TxSubmitError(
      lastFailure ?? {
        success: false,
        error: "NONCE_RETRIES_EXHAUSTED",
        message: `Failed after ${MAX_NONCE_RETRIES} attempts`,
      }
    );
  }

  /**
   * 持久化回执（节点 `get_receipt`）。
   * chain 查询结果 `{ found: false }` 视为未命中，而不是异常。
   */
  async function getStoredReceipt(txHashInput: string): Promise<StoredReceiptRpc | null> {
    const rawHash = txHashInput.trim();
    if (!rawHash) {
      throw new Error("tx_hash is required");
    }
    let r: Awaited<ReturnType<typeof raw.getReceipt>>;
    try {
      r = await raw.getReceipt(rawHash);
    } catch (error) {
      if (isReceiptNotFoundError(error)) {
        return null;
      }
      throw error;
    }
    if (isPersistentReceipt(r)) {
      return r;
    }
    if (isReceiptNotFoundResult(r)) {
      return null;
    }
    return null;
  }

  async function sendHybridMigrationWithRetry(
    input: SendHybridMigrationInput,
    ed25519SeedHex: string,
    pqSeedHex: string
  ): Promise<SendTxResult> {
    const fee = input.fee ?? "1";
    const feeBi = parseAmountString(fee);
    const seed = seedFromHex64(ed25519SeedHex);
    const pqSeed = seedFromHex64(pqSeedHex);
    const derivedAddress = addressHexFromSeed(seed);
    const requestedFrom = input.from ? normalizeAddressForChain(input.from) : undefined;

    if (requestedFrom && isLegacyHexAddress(requestedFrom)) {
      if (requestedFrom.toLowerCase() !== derivedAddress.toLowerCase()) {
        throw new TxInputError(
          `FROM_MISMATCH: provided from ${requestedFrom} does not match privateKey-derived address ${derivedAddress}`
        );
      }
    }

    const effectiveFrom =
      requestedFrom && requestedFrom.length > 0 ? requestedFrom : derivedAddress;
    const summary = await raw.getWalletSummary(effectiveFrom);
    const finalNonce =
      input.nonce !== undefined && input.nonce !== null
        ? Number(input.nonce)
        : summary.next_nonce;
    const currentAccountType =
      summary.account_type === "pq_mldsa"
        ? "pq_mldsa"
        : summary.account_type === HYBRID_ACCOUNT_TYPE
          ? HYBRID_ACCOUNT_TYPE
          : DEFAULT_ACCOUNT_TYPE;

    if (currentAccountType !== DEFAULT_ACCOUNT_TYPE) {
      throw new TxInputError(
        `MIGRATION_REQUIRES_LEGACY_ACCOUNT: account currently reports ${currentAccountType}; only legacy_ed25519 -> hybrid migration is supported`
      );
    }

    const available = parseAmountString(summary.available);
    if (available < feeBi) {
      throw new TxInputError(
        `INSUFFICIENT_BALANCE: available ${summary.available} < amount 0 + fee ${fee}`
      );
    }

    const pqKeys = mldsa65KeypairFromSeed(pqSeed);
    const migration = {
      target_auth_mode: "hybrid",
      target_account_type: HYBRID_ACCOUNT_TYPE,
      target_account_keys: [
        {
          scheme: "ed25519",
          public_key: effectiveFrom,
          key_id: "primary",
        },
        {
          scheme: "mldsa",
          public_key: `0x${pqKeys.publicKeyHex}`,
          key_id: "pq-primary",
        },
      ],
      target_migration_version:
        input.targetMigrationVersion ?? (summary.pq_key_count ?? 0) + 2,
    };
    const unsigned: UnsignedTransfer = {
      from: effectiveFrom,
      to: effectiveFrom,
      amount: BigInt(0),
      nonce: BigInt(finalNonce),
      fee: feeBi,
      migration,
    };
    const auth = await signTransferWithAccount(unsigned, seed, {
      authMode: "single",
      accountType: DEFAULT_ACCOUNT_TYPE,
    });

    const params: Record<string, unknown> = {
      from: effectiveFrom,
      to: effectiveFrom,
      value: 0,
      fee: rpcAmountField(feeBi),
      nonce: finalNonce,
      signature: `0x${auth.signatureHex}`,
      public_key: `0x${auth.publicKeyHex}`,
      signature_scheme: auth.signatureScheme,
      auth_proofs: auth.authProofs,
      auth_mode: auth.authMode,
      from_address_type: inferAddressType(effectiveFrom),
      account_type: DEFAULT_ACCOUNT_TYPE,
      account_keys: auth.accountKeys,
      migration,
    };

    const result = await raw.sendTransaction(params);
    if (result.success) {
      return {
        tx_hash: result.hash,
      mempool_status: result.mempool_status ?? "pending",
      };
    }
    throw new TxSubmitError(result);
  }

  /**
   * 单笔状态：
   * - receipt 存在 → `confirmed`
   * - get_transaction.status === included → `included`
   * - get_transaction.status === pending → `pending`
   * - 其余 → `not_found`
   */
  async function getTxStatus(txHashInput: string): Promise<TxStatusResult> {
    const rawHash = txHashInput.trim();
    if (!rawHash) {
      throw new Error("tx_hash is required");
    }

    const tx = await raw.getTransaction(rawHash);
    if (tx === null || typeof tx !== "object") {
      return { tx_hash: rawHash, status: "not_found" };
    }

    const hashField =
      typeof (tx as { hash?: unknown }).hash === "string"
        ? String((tx as { hash: string }).hash).trim()
        : rawHash;
    const st = (tx as { status?: string }).status;

    if (st === "pending") {
      return { tx_hash: hashField, status: "pending" };
    }
    if (st === "included") {
      let stored: Awaited<ReturnType<typeof raw.getReceipt>> | null = null;
      try {
        stored = await raw.getReceipt(rawHash);
      } catch (error) {
        if (!isReceiptNotFoundError(error)) {
          throw error;
        }
      }
      if (isPersistentReceipt(stored)) {
        return { tx_hash: stored.tx_hash, status: "confirmed" };
      }
      return { tx_hash: hashField, status: "included" };
    }

    return { tx_hash: rawHash, status: "not_found" };
  }

  return {
    submitSignedTransaction,
    sendTransferWithRetry,
    /** 与 `sendTransferWithRetry` 相同，便于命名对齐 */
    send: sendTransferWithRetry,
    sendValidatorRegisterWithRetry: (
      input: SendStakingInput,
      ed25519SeedHex: string,
      options?: { pqSeedHex?: string }
    ) => sendStakingWithRetry("validator_register", input, ed25519SeedHex, options),
    sendStakeBondWithRetry: (
      input: SendStakingInput,
      ed25519SeedHex: string,
      options?: { pqSeedHex?: string }
    ) => sendStakingWithRetry("stake_bond", input, ed25519SeedHex, options),
    sendStakeUnbondWithRetry: (
      input: SendStakingInput,
      ed25519SeedHex: string,
      options?: { pqSeedHex?: string }
    ) => sendStakingWithRetry("stake_unbond", input, ed25519SeedHex, options),
    sendStakeUnbondFinalizeWithRetry: (
      input: SendStakingInput,
      ed25519SeedHex: string,
      options?: { pqSeedHex?: string }
    ) => sendStakingWithRetry("stake_unbond_finalize", input, ed25519SeedHex, options),
    sendStakeRewardClaimWithRetry: (
      input: SendStakingInput,
      ed25519SeedHex: string,
      options?: { pqSeedHex?: string }
    ) => sendStakingWithRetry("stake_reward_claim", input, ed25519SeedHex, options),
    sendHybridMigrationWithRetry,
    getTxStatus,
    getStoredReceipt,
  };
}

export type TxService = ReturnType<typeof createTxService>;

export class TxSubmitError extends Error {
  constructor(public readonly result: SendTransactionResult) {
    const msg =
      result.success === false
        ? `${result.error}: ${result.message ?? ""}`
        : "Unknown tx error";
    super(msg);
    this.name = "TxSubmitError";
  }
}

export class TxInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxInputError";
  }
}

function parseTxInputErrorCode(message: string): string | null {
  const matched = /^([A-Z0-9_]+):/.exec(message.trim());
  return matched ? matched[1] : null;
}

function httpStatusForSubmitError(result: Extract<SendTransactionResult, { success: false }>): number {
  switch (result.error) {
    case "ERR_INSUFFICIENT_BALANCE":
    case "ERR_INVALID_TX":
    case "ERR_INVALID_TX_PARAMS":
    case "ERR_INVALID_RAW_TX":
    case "ERR_INVALID_SIGNATURE":
    case "ERR_SIGNATURE_REQUIRED":
    case "ERR_PUBLIC_KEY_REQUIRED":
    case "ERR_FROM_PUBLIC_KEY_MISMATCH":
    case "ERR_INVALID_HEX":
      return 400;
    case "ERR_NONCE_TOO_LOW":
    case "ERR_NONCE_TOO_HIGH":
    case "ERR_FUTURE_NONCE_LIMIT":
    case "ERR_TX_ALREADY_EXISTS":
      return 409;
    case "ERR_MEMPOOL_FULL":
      return 503;
    case "ERR_INVALID_STAKING":
      return result.message?.includes("validator already registered") ? 409 : 400;
    default:
      return 502;
  }
}

/** 将 RpcError 转为 HTTP 友好信息 */
export function formatRpcOrTxError(e: unknown): { status: number; body: object } {
  if (e instanceof TxSubmitError && e.result.success === false) {
    const r = e.result;
    const status = httpStatusForSubmitError(r);
    return { status, body: { error: r.error, message: r.message } };
  }
  if (e instanceof RpcError) {
    return { status: 502, body: { error: "RPC_ERROR", message: e.message } };
  }
  if (e instanceof TxInputError) {
    const code = parseTxInputErrorCode(e.message);
    if (code === "HYBRID_PQ_SEED_REQUIRED") {
      return {
        status: 409,
        body: {
          error: code,
          message: e.message,
          recommended_action:
            "Provide pqPrivateKey and resubmit with hybrid Ed25519 + ML-DSA signing.",
          ui_hint:
            "该账户已进入 hybrid 模式，不能再按旧单签方式发送交易。",
        },
      };
    }
    if (code === "MIGRATION_REQUIRES_LEGACY_ACCOUNT") {
      return {
        status: 409,
        body: {
          error: code,
          message: e.message,
          recommended_action:
            "Query post-quantum readiness first and avoid re-running legacy-to-hybrid migration on an upgraded account.",
          ui_hint:
            "该账户已不是 legacy 账户，无需再次执行 legacy -> hybrid 迁移。",
        },
      };
    }
    if (code === "PURE_PQ_ACCOUNT_NOT_SUPPORTED_YET") {
      return {
        status: 409,
        body: {
          error: code,
          message: e.message,
          recommended_action:
            "Use a hybrid account for now or wait until pure pq_mldsa wallet submission is implemented.",
          ui_hint:
            "当前钱包还不支持纯 PQ 账户直接发交易，请先使用 hybrid 账户路径。",
        },
      };
    }
    if (code === "VALIDATOR_ADDRESS_REQUIRED" || code === "STAKE_AMOUNT_REQUIRED") {
      return { status: 400, body: { error: code, message: e.message } };
    }
    return { status: 400, body: { error: "TX_INPUT_ERROR", message: e.message } };
  }
  if (e instanceof Error) {
    return { status: 500, body: { error: "INTERNAL", message: e.message } };
  }
  return { status: 500, body: { error: "INTERNAL", message: String(e) } };
}
