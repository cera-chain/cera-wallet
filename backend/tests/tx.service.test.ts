import test from "node:test";
import assert from "node:assert/strict";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";

import { createTxController } from "../src/controllers/tx.controller.js";
import { RpcError } from "../src/rpc/client.js";
import { addressHexFromSeed, seedFromHex64 } from "../src/services/signer.js";
import { HYBRID_ACCOUNT_TYPE } from "../src/services/hybrid-signer.js";
import { transactionIdHashBytes } from "../src/utils/txHash.js";
import {
  createTxService,
  TxInputError,
  TxSubmitError,
  formatRpcOrTxError,
} from "../src/services/tx.service.js";

function createMockRpc(options: {
  summaries: Array<{
    next_nonce: number;
    available: string;
    balance: string;
    account_auth_mode?: string;
    account_type?: string;
  }>;
  sendResults: Array<
    | { success: true; hash: string }
    | { success: false; error: string; message?: string }
  >;
}) {
  const summaryCalls: string[] = [];
  const sendCalls: Array<Record<string, unknown>> = [];

  const rpc = {
    async call(method: string, params: Record<string, unknown>) {
      if (method !== "get_wallet_summary") {
        throw new Error(`unexpected rpc.call method: ${method}`);
      }
      summaryCalls.push(String(params.address));
      const next = options.summaries.shift();
      if (!next) {
        throw new Error("no mocked wallet summary left");
      }
      return {
        address: String(params.address),
        pending_out: "0",
        pending_in: "0",
        locked_balance: "0",
        nonce: next.next_nonce,
        next_nonce: next.next_nonce,
        chain_nonce: Math.max(0, next.next_nonce - 1),
        pending_max_nonce: 0,
        block_height: 1,
        available: next.available,
        balance: next.balance,
        account_auth_mode: next.account_auth_mode,
        account_type: next.account_type,
      };
    },
    async callSendTransaction(params: Record<string, unknown>) {
      sendCalls.push({ ...params });
      const next = options.sendResults.shift();
      if (!next) {
        throw new Error("no mocked send_transaction result left");
      }
      return next;
    },
  };

  return { rpc, summaryCalls, sendCalls };
}

test("formatRpcOrTxError maps TxInputError to HTTP 400", () => {
  const result = formatRpcOrTxError(
    new TxInputError("FROM_MISMATCH: provided from does not match private key")
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "TX_INPUT_ERROR",
    message: "FROM_MISMATCH: provided from does not match private key",
  });
});

test("formatRpcOrTxError preserves local insufficient-balance TxInputError details", () => {
  const result = formatRpcOrTxError(
    new TxInputError("INSUFFICIENT_BALANCE: available 9 < amount 10 + fee 1")
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "TX_INPUT_ERROR",
    message: "INSUFFICIENT_BALANCE: available 9 < amount 10 + fee 1",
  });
});

test("formatRpcOrTxError maps ERR_TX_ALREADY_EXISTS to HTTP 409", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_TX_ALREADY_EXISTS",
      message: "transaction already exists",
      location: "mempool",
    })
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "ERR_TX_ALREADY_EXISTS",
    message: "transaction already exists",
  });
});

test("formatRpcOrTxError maps ERR_MEMPOOL_FULL to HTTP 503", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_MEMPOOL_FULL",
      message: "Mempool is full",
    })
  );

  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "ERR_MEMPOOL_FULL",
    message: "Mempool is full",
  });
});

test("formatRpcOrTxError maps ERR_FUTURE_NONCE_LIMIT to HTTP 409", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_FUTURE_NONCE_LIMIT",
      message: "too many future transactions for sender (limit 16)",
      limit: 16,
    })
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "ERR_FUTURE_NONCE_LIMIT",
    message: "too many future transactions for sender (limit 16)",
  });
});

test("formatRpcOrTxError maps ERR_INVALID_SIGNATURE to HTTP 400", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_INVALID_SIGNATURE",
      message: "signature verification failed",
    })
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "ERR_INVALID_SIGNATURE",
    message: "signature verification failed",
  });
});

test("formatRpcOrTxError maps duplicate validator registration to HTTP 409", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_INVALID_STAKING",
      message: "validator already registered",
    })
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "ERR_INVALID_STAKING",
    message: "validator already registered",
  });
});

test("formatRpcOrTxError maps other invalid staking errors to HTTP 400", () => {
  const result = formatRpcOrTxError(
    new TxSubmitError({
      success: false,
      error: "ERR_INVALID_STAKING",
      message: "stake target validator must be active",
    })
  );

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    error: "ERR_INVALID_STAKING",
    message: "stake target validator must be active",
  });
});

test("getStoredReceipt converts node receipt-not-found RpcError into null", async () => {
  const tx = createTxService({
    async call(method: string) {
      if (method === "get_receipt") {
        throw new RpcError("receipt not found", -32004);
      }
      throw new Error(`unexpected rpc.call method: ${method}`);
    },
    async callSendTransaction() {
      throw new Error("unexpected callSendTransaction");
    },
  } as never);

  const receipt = await tx.getStoredReceipt("0xabc");

  assert.equal(receipt, null);
});

test("getTxStatus checks get_transaction before receipt for pending transactions", async () => {
  const calls: string[] = [];
  const tx = createTxService({
    async call(method: string) {
      calls.push(method);
      if (method === "get_receipt") {
        throw new Error("pending status should not query receipt");
      }
      if (method === "get_transaction") {
        return {
          hash: "0xabc",
          from: "alice",
          to: "bob",
          value: "7",
          fee: "1",
          nonce: 2,
          status: "pending",
        };
      }
      throw new Error(`unexpected rpc.call method: ${method}`);
    },
    async callSendTransaction() {
      throw new Error("unexpected callSendTransaction");
    },
  } as never);

  const status = await tx.getTxStatus("0xabc");

  assert.deepEqual(status, {
    tx_hash: "0xabc",
    status: "pending",
  });
  assert.deepEqual(calls, ["get_transaction"]);
});

test("getTxStatus returns not_found without querying receipt when transaction misses", async () => {
  const calls: string[] = [];
  const tx = createTxService({
    async call(method: string) {
      calls.push(method);
      if (method === "get_receipt") {
        throw new Error("missing transaction should not query receipt");
      }
      if (method === "get_transaction") {
        return null;
      }
      throw new Error(`unexpected rpc.call method: ${method}`);
    },
    async callSendTransaction() {
      throw new Error("unexpected callSendTransaction");
    },
  } as never);

  const status = await tx.getTxStatus("0xmissing");

  assert.deepEqual(status, {
    tx_hash: "0xmissing",
    status: "not_found",
  });
  assert.deepEqual(calls, ["get_transaction"]);
});

test("tx controller send rejects client secret material with HTTP 400", async () => {
  const controller = createTxController({
    submitSignedTransaction: async () => {
      throw new Error("should not call service when private key is present");
    },
  } as never);

  const req = {
    body: {
      to: "bob",
      amount: "1",
      privateKey: "11".repeat(32),
      nonce: "-1",
    },
  };

  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.send(req as never, res as never);

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonBody, {
    error: "CLIENT_SECRET_REJECTED",
    message:
      "Submit only signed transaction fields. Private keys, PQ private keys, seeds, and mnemonics must stay in the browser.",
  });
});

test("tx controller send forwards signed transaction body", async () => {
  let submitted: unknown;
  const controller = createTxController({
    submitSignedTransaction: async (body: unknown) => {
      submitted = body;
      return { tx_hash: "0xsigned", mempool_status: "pending" };
    },
  } as never);

  const req = {
    body: {
      from: "alice",
      to: "bob",
      value: 1,
      fee: 1,
      nonce: 2,
      signature: "0xsig",
    },
  };

  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.send(req as never, res as never);

  assert.equal(statusCode, 200);
  assert.deepEqual(submitted, req.body);
  assert.deepEqual(jsonBody, {
    tx_hash: "0xsigned",
    mempool_status: "pending",
  });
});

test("formatRpcOrTxError exposes hybrid-signing guidance for missing pq seed", () => {
  const result = formatRpcOrTxError(
    new TxInputError(
      "HYBRID_PQ_SEED_REQUIRED: account requires hybrid_ed25519_mldsa signing but pqSeedHex was not provided"
    )
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "HYBRID_PQ_SEED_REQUIRED",
    message:
      "HYBRID_PQ_SEED_REQUIRED: account requires hybrid_ed25519_mldsa signing but pqSeedHex was not provided",
    recommended_action:
      "Provide pqPrivateKey and resubmit with hybrid Ed25519 + ML-DSA signing.",
    ui_hint: "该账户已进入 hybrid 模式，不能再按旧单签方式发送交易。",
  });
});

test("formatRpcOrTxError exposes migration guidance for non-legacy accounts", () => {
  const result = formatRpcOrTxError(
    new TxInputError(
      "MIGRATION_REQUIRES_LEGACY_ACCOUNT: account currently reports hybrid_ed25519_mldsa; only legacy_ed25519 -> hybrid migration is supported"
    )
  );

  assert.equal(result.status, 409);
  assert.deepEqual(result.body, {
    error: "MIGRATION_REQUIRES_LEGACY_ACCOUNT",
    message:
      "MIGRATION_REQUIRES_LEGACY_ACCOUNT: account currently reports hybrid_ed25519_mldsa; only legacy_ed25519 -> hybrid migration is supported",
    recommended_action:
      "Query post-quantum readiness first and avoid re-running legacy-to-hybrid migration on an upgraded account.",
    ui_hint: "该账户已不是 legacy 账户，无需再次执行 legacy -> hybrid 迁移。",
  });
});

test("tx controller receipt rejects missing tx_hash with HTTP 400", async () => {
  const controller = createTxController({} as never);

  const req = { query: {} };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.receipt(req as never, res as never);

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonBody, {
    error: "tx_hash query param is required",
  });
});

test("tx controller receipt returns HTTP 404 when receipt is missing", async () => {
  const controller = createTxController({
    getStoredReceipt: async () => null,
  } as never);

  const req = { query: { tx_hash: "0xabc" } };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.receipt(req as never, res as never);

  assert.equal(statusCode, 404);
  assert.deepEqual(jsonBody, {
    error: "RECEIPT_NOT_FOUND",
    tx_hash: "0xabc",
  });
});

test("tx controller receipt maps RpcError to HTTP 502", async () => {
  const controller = createTxController({
    getStoredReceipt: async () => {
      throw new RpcError("node unavailable");
    },
  } as never);

  const req = { query: { tx_hash: "0xabc" } };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.receipt(req as never, res as never);

  assert.equal(statusCode, 502);
  assert.deepEqual(jsonBody, {
    error: "RPC_ERROR",
    message: "node unavailable",
  });
});

test("tx controller status rejects missing tx_hash with HTTP 400", async () => {
  const controller = createTxController({} as never);

  const req = { query: {} };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.status(req as never, res as never);

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonBody, {
    error: "tx_hash query param is required",
  });
});

test("tx controller status maps RpcError to HTTP 502", async () => {
  const controller = createTxController({
    getTxStatus: async () => {
      throw new RpcError("node unavailable");
    },
  } as never);

  const req = { query: { tx_hash: "0xabc" } };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.status(req as never, res as never);

  assert.equal(statusCode, 502);
  assert.deepEqual(jsonBody, {
    error: "RPC_ERROR",
    message: "node unavailable",
  });
});

test("tx controller status maps TxInputError to HTTP 400", async () => {
  const controller = createTxController({
    getTxStatus: async () => {
      throw new TxInputError("FROM_MISMATCH: invalid tx hash lookup context");
    },
  } as never);

  const req = { query: { tx_hash: "0xabc" } };
  let statusCode = 200;
  let jsonBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  };

  await controller.status(req as never, res as never);

  assert.equal(statusCode, 400);
  assert.deepEqual(jsonBody, {
    error: "TX_INPUT_ERROR",
    message: "FROM_MISMATCH: invalid tx hash lookup context",
  });
});

test("sendTransferWithRetry retries after ERR_NONCE_TOO_LOW and succeeds", async () => {
  const mock = createMockRpc({
    summaries: [
      { next_nonce: 5, available: "100", balance: "100" },
      { next_nonce: 6, available: "100", balance: "100" },
    ],
    sendResults: [
      { success: false, error: "ERR_NONCE_TOO_LOW", message: "refresh and retry" },
      { success: true, hash: "0xabc123" },
    ],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendTransferWithRetry(
    {
      from: "alice",
      to: "bob",
      amount: "10",
      fee: "1",
    },
    "11".repeat(32)
  );

  assert.deepEqual(result, { tx_hash: "0xabc123", mempool_status: "pending" });
  assert.equal(mock.summaryCalls.length, 2);
  assert.equal(mock.sendCalls.length, 2);
  assert.equal(mock.sendCalls[0].nonce, 5);
  assert.equal(mock.sendCalls[1].nonce, 6);
});

test("sendTransferWithRetry retries after ERR_NONCE_TOO_HIGH and succeeds", async () => {
  const mock = createMockRpc({
    summaries: [
      { next_nonce: 7, available: "100", balance: "100" },
      { next_nonce: 4, available: "100", balance: "100" },
    ],
    sendResults: [
      { success: false, error: "ERR_NONCE_TOO_HIGH", message: "do not skip nonces" },
      { success: true, hash: "0xdef456" },
    ],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendTransferWithRetry(
    {
      from: "alice",
      to: "bob",
      amount: "10",
      fee: "1",
    },
    "11".repeat(32)
  );

  assert.deepEqual(result, { tx_hash: "0xdef456", mempool_status: "pending" });
  assert.equal(mock.summaryCalls.length, 2);
  assert.equal(mock.sendCalls.length, 2);
  assert.equal(mock.sendCalls[0].nonce, 7);
  assert.equal(mock.sendCalls[1].nonce, 4);
});

test("sendTransferWithRetry forwards explicit future nonce without local normalization", async () => {
  const mock = createMockRpc({
    summaries: [{ next_nonce: 2, available: "100", balance: "100" }],
    sendResults: [{ success: true, hash: "0xfuture123" }],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendTransferWithRetry(
    {
      from: "alice",
      to: "bob",
      amount: "10",
      fee: "1",
      nonce: 5,
    },
    "11".repeat(32)
  );

  assert.deepEqual(result, { tx_hash: "0xfuture123", mempool_status: "pending" });
  assert.equal(mock.summaryCalls.length, 1);
  assert.equal(mock.sendCalls.length, 1);
  assert.equal(mock.sendCalls[0].nonce, 5);
});

test("sendTransferWithRetry does not retry ERR_FUTURE_NONCE_LIMIT", async () => {
  const mock = createMockRpc({
    summaries: [{ next_nonce: 1, available: "100", balance: "100" }],
    sendResults: [
      {
        success: false,
        error: "ERR_FUTURE_NONCE_LIMIT",
        message: "too many future transactions for sender (limit 16)",
      },
    ],
  });
  const tx = createTxService(mock.rpc as never);

  await assert.rejects(
    () =>
      tx.sendTransferWithRetry(
        {
          from: "alice",
          to: "bob",
          amount: "10",
          fee: "1",
          nonce: 9,
        },
        "11".repeat(32)
      ),
    (error: unknown) => {
      assert.ok(error instanceof TxSubmitError);
      assert.equal(error.result.success, false);
      if (error.result.success === false) {
        assert.equal(error.result.error, "ERR_FUTURE_NONCE_LIMIT");
      }
      return true;
    }
  );

  assert.equal(mock.summaryCalls.length, 1);
  assert.equal(mock.sendCalls.length, 1);
  assert.equal(mock.sendCalls[0].nonce, 9);
});

test("sendTransferWithRetry does not retry nonce errors when user nonce is explicit", async () => {
  const mock = createMockRpc({
    summaries: [{ next_nonce: 9, available: "100", balance: "100" }],
    sendResults: [
      { success: false, error: "ERR_NONCE_TOO_LOW", message: "refresh and retry" },
    ],
  });
  const tx = createTxService(mock.rpc as never);

  await assert.rejects(
    () =>
      tx.sendTransferWithRetry(
        {
          from: "alice",
          to: "bob",
          amount: "10",
          fee: "1",
          nonce: 3,
        },
        "11".repeat(32)
      ),
    (error: unknown) => {
      assert.ok(error instanceof TxSubmitError);
      assert.equal(error.result.success, false);
      if (error.result.success === false) {
        assert.equal(error.result.error, "ERR_NONCE_TOO_LOW");
      }
      return true;
    }
  );

  assert.equal(mock.summaryCalls.length, 1);
  assert.equal(mock.sendCalls.length, 1);
  assert.equal(mock.sendCalls[0].nonce, 3);
});

test("sendTransferWithRetry fails after exhausting nonce retries", async () => {
  const mock = createMockRpc({
    summaries: [
      { next_nonce: 1, available: "100", balance: "100" },
      { next_nonce: 2, available: "100", balance: "100" },
      { next_nonce: 3, available: "100", balance: "100" },
    ],
    sendResults: [
      { success: false, error: "ERR_NONCE_TOO_LOW", message: "retry 1" },
      { success: false, error: "ERR_NONCE_TOO_LOW", message: "retry 2" },
      { success: false, error: "ERR_NONCE_TOO_LOW", message: "retry 3" },
    ],
  });
  const tx = createTxService(mock.rpc as never);

  await assert.rejects(
    () =>
      tx.sendTransferWithRetry(
        {
          from: "alice",
          to: "bob",
          amount: "10",
          fee: "1",
        },
        "11".repeat(32)
      ),
    (error: unknown) => {
      assert.ok(error instanceof TxSubmitError);
      assert.equal(error.result.success, false);
      if (error.result.success === false) {
        assert.equal(error.result.error, "ERR_NONCE_TOO_LOW");
        assert.equal(error.result.message, "retry 3");
      }
      return true;
    }
  );

  assert.equal(mock.summaryCalls.length, 3);
  assert.equal(mock.sendCalls.length, 3);
});

test("sendTransferWithRetry performs a signed submission with expected rpc fields", async () => {
  const mock = createMockRpc({
    summaries: [{ next_nonce: 8, available: "100", balance: "100" }],
    sendResults: [{ success: true, hash: "0xfeedbeef" }],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendTransferWithRetry(
    {
      from: "alice",
      to: "bob",
      amount: "10",
      fee: "1",
    },
    "11".repeat(32)
  );

  assert.deepEqual(result, { tx_hash: "0xfeedbeef", mempool_status: "pending" });
  assert.equal(mock.summaryCalls.length, 1);
  assert.equal(mock.sendCalls.length, 1);

  const submitted = mock.sendCalls[0];
  assert.equal(submitted.from, "alice");
  assert.equal(submitted.to, "bob");
  assert.equal(submitted.value, 10);
  assert.equal(submitted.fee, 1);
  assert.equal(submitted.nonce, 8);
  assert.equal(typeof submitted.signature, "string");
  assert.equal(typeof submitted.public_key, "string");
  assert.equal(submitted.signature_scheme, "ed25519");
  assert.equal(submitted.from_address_type, "legacy_named");
  assert.equal(submitted.auth_mode, "single");
  assert.equal(submitted.account_type, "legacy_ed25519");
  assert.ok(Array.isArray(submitted.auth_proofs));
  assert.ok(Array.isArray(submitted.account_keys));
  assert.equal((submitted.auth_proofs as Array<unknown>).length, 1);
  assert.equal((submitted.account_keys as Array<unknown>).length, 1);
  assert.match(String(submitted.signature), /^0x[0-9a-f]+$/i);
  assert.match(String(submitted.public_key), /^0x[0-9a-f]+$/i);
});

test("sendTransferWithRetry rejects hybrid accounts without pq seed", async () => {
  const mock = createMockRpc({
    summaries: [
      {
        next_nonce: 1,
        available: "100",
        balance: "100",
        account_auth_mode: "hybrid",
        account_type: "hybrid_ed25519_mldsa",
      },
    ],
    sendResults: [],
  });
  const tx = createTxService(mock.rpc as never);

  await assert.rejects(
    () =>
      tx.sendTransferWithRetry(
        {
          from: "alice",
          to: "bob",
          amount: "10",
          fee: "1",
        },
        "11".repeat(32)
      ),
    (error: unknown) =>
      error instanceof TxInputError &&
      error.message.includes("HYBRID_PQ_SEED_REQUIRED")
  );

  assert.equal(mock.sendCalls.length, 0);
});

test("sendTransferWithRetry submits hybrid account with ed25519 + mldsa proofs", async () => {
  const edSeedHex = "11".repeat(32);
  const pqSeedHex = "22".repeat(32);
  const from = addressHexFromSeed(seedFromHex64(edSeedHex));
  const mock = createMockRpc({
    summaries: [
      {
        next_nonce: 4,
        available: "100",
        balance: "100",
        account_auth_mode: "hybrid",
        account_type: HYBRID_ACCOUNT_TYPE,
      },
    ],
    sendResults: [{ success: true, hash: "0xhybrid123" }],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendTransferWithRetry(
    {
      from,
      to: "bob",
      amount: "10",
      fee: "1",
    },
    edSeedHex,
    { pqSeedHex }
  );

  assert.deepEqual(result, { tx_hash: "0xhybrid123", mempool_status: "pending" });
  assert.equal(mock.sendCalls.length, 1);

  const submitted = mock.sendCalls[0];
  assert.equal(submitted.from, from);
  assert.equal(submitted.auth_mode, "hybrid");
  assert.equal(submitted.account_type, HYBRID_ACCOUNT_TYPE);
  assert.equal(submitted.signature_scheme, "ed25519");

  const authProofs = submitted.auth_proofs as Array<Record<string, unknown>>;
  const accountKeys = submitted.account_keys as Array<Record<string, unknown>>;
  assert.equal(authProofs.length, 2);
  assert.equal(accountKeys.length, 2);
  assert.equal(authProofs[0].scheme, "ed25519");
  assert.equal(authProofs[0].key_id, "primary");
  assert.equal(authProofs[1].scheme, "mldsa");
  assert.equal(authProofs[1].key_id, "pq-primary");
  assert.equal(accountKeys[1].scheme, "mldsa");
  assert.equal(accountKeys[1].key_id, "pq-primary");

  const message = transactionIdHashBytes({
    from,
    to: "bob",
    amount: BigInt(10),
    nonce: BigInt(4),
    fee: BigInt(1),
    isCoinbase: false,
  });
  const pqSignature = Buffer.from(
    String(authProofs[1].signature).replace(/^0x/i, ""),
    "hex"
  );
  const pqPublicKey = Buffer.from(
    String(authProofs[1].public_key).replace(/^0x/i, ""),
    "hex"
  );
  assert.equal(ml_dsa65.verify(pqSignature, message, pqPublicKey), true);
});

test("sendHybridMigrationWithRetry submits on-chain migration payload", async () => {
  const edSeedHex = "11".repeat(32);
  const pqSeedHex = "22".repeat(32);
  const from = addressHexFromSeed(seedFromHex64(edSeedHex));
  const mock = createMockRpc({
    summaries: [
      {
        next_nonce: 5,
        available: "100",
        balance: "100",
        account_auth_mode: "single",
        account_type: "legacy_ed25519",
      },
    ],
    sendResults: [{ success: true, hash: "0xmigrate123" }],
  });
  const tx = createTxService(mock.rpc as never);

  const result = await tx.sendHybridMigrationWithRetry(
    { from, fee: "1" },
    edSeedHex,
    pqSeedHex
  );

  assert.deepEqual(result, { tx_hash: "0xmigrate123", mempool_status: "pending" });
  assert.equal(mock.sendCalls.length, 1);
  const submitted = mock.sendCalls[0];
  assert.equal(submitted.from, from);
  assert.equal(submitted.to, from);
  assert.equal(submitted.value, 0);
  assert.equal(submitted.account_type, "legacy_ed25519");
  const migration = submitted.migration as Record<string, unknown>;
  assert.equal(migration.target_auth_mode, "hybrid");
  assert.equal(migration.target_account_type, HYBRID_ACCOUNT_TYPE);
  const targetKeys = migration.target_account_keys as Array<Record<string, unknown>>;
  assert.equal(targetKeys.length, 2);
  assert.equal(targetKeys[0].scheme, "ed25519");
  assert.equal(targetKeys[1].scheme, "mldsa");
});
