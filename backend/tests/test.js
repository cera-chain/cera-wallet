import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const walletRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(walletRoot, "..");
const chainRoot = path.resolve(workspaceRoot, "cera-chain");

const rpcPort = Number(process.env.CERA_TEST_RPC_PORT ?? 18545);
const walletPort = Number(process.env.CERA_TEST_WALLET_PORT ?? 13000);
const p2pPort = Number(process.env.CERA_TEST_P2P_PORT ?? 16000);
const miningIntervalSecs = Number(process.env.CERA_TEST_MINING_INTERVAL_SECS ?? 4);

const senderSeed =
  process.env.CERA_TEST_SENDER_SEED ??
  "1111111111111111111111111111111111111111111111111111111111111111";
const senderAddress =
  process.env.CERA_TEST_SENDER_ADDRESS ??
  "0xd04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
const secondSeed =
  process.env.CERA_TEST_SECOND_SEED ??
  "2222222222222222222222222222222222222222222222222222222222222222";
const secondAddress =
  process.env.CERA_TEST_SECOND_ADDRESS ??
  "0xa09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";
const receiverAddress =
  process.env.CERA_TEST_RECEIVER_ADDRESS ??
  "0xa09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0";

const amount = "7";
const fee = "1";
const stakingActionCount = 8n;
const testDataDir = path.resolve(chainRoot, "data-js-protocol-test");
const runDir = path.resolve(walletRoot, "tests", ".runs");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const currentRunDir = path.resolve(runDir, `run-${timestamp}`);

const nodeLogs = {
  stdout: path.resolve(currentRunDir, "node.stdout.log"),
  stderr: path.resolve(currentRunDir, "node.stderr.log"),
};
const walletLogs = {
  stdout: path.resolve(currentRunDir, "wallet.stdout.log"),
  stderr: path.resolve(currentRunDir, "wallet.stderr.log"),
};

const summary = {
  pass: 0,
  fail: 0,
};

let nodeProc = null;
let walletProc = null;

function printDivider() {
  console.log("------------------------------------------------------------");
}

function pretty(value) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function printStep({ operation, expected, actual, pass }) {
  printDivider();
  console.log(`操作: ${operation}`);
  console.log(`预期结果: ${expected}`);
  console.log(`实际结果: ${pretty(actual)}`);
  console.log(pass ? "PASS" : "FAIL");
  if (pass) {
    summary.pass += 1;
  } else {
    summary.fail += 1;
  }
}

function assertStep(operation, expected, actual, pass) {
  printStep({ operation, expected, actual, pass });
  if (!pass) {
    throw new Error(`${operation} failed`);
  }
}

async function expectFailure(operation, expected, fn, matcher) {
  try {
    const result = await fn();
    assertStep(operation, expected, result, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const pass = typeof matcher === "function" ? matcher(message) : message.includes(String(matcher));
    assertStep(operation, expected, { message }, pass);
    if (!pass) {
      throw error;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, fn, timeoutMs = 30_000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `Timed out waiting for ${description}${lastError ? `; last error: ${lastError.message}` : ""}`
  );
}

function commandPath(base, winSuffix = "") {
  return process.platform === "win32" ? `${base}${winSuffix}` : base;
}

function pipeLogs(child, logFile) {
  const stream = createWriteStream(logFile, { flags: "a" });
  child.pipe(stream);
}

function spawnManagedProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
  pipeLogs(child.stdout, options.stdoutPath);
  pipeLogs(child.stderr, options.stderrPath);
  return child;
}

async function cleanupDir() {
  await rm(testDataDir, { recursive: true, force: true });
  await mkdir(currentRunDir, { recursive: true });
}

function selectNodeCommand() {
  return {
    command: commandPath("cargo", ".exe"),
    args: ["run", "--bin", "cera-node"],
  };
}

function selectWalletCommand() {
  const tsxCli = path.resolve(
    walletRoot,
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs"
  );
  if (existsSync(tsxCli)) {
    return {
      command: process.execPath,
      args: [tsxCli, "src/app.ts"],
    };
  }
  throw new Error(`tsx CLI not found at ${tsxCli}. Run npm install in cera-wallet first.`);
}

async function jsonRpc(method, params = {}) {
  const response = await fetch(`http://127.0.0.1:${rpcPort}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  const body = await response.json();
  if (body.error) {
    throw new Error(`${method} RPC error: ${body.error.message}`);
  }
  return body.result;
}

async function walletGet(pathname, searchParams = {}) {
  const url = new URL(`http://127.0.0.1:${walletPort}${pathname}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url);
  if (response.status === 404) {
    return { notFound: true };
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${pathname} failed: ${response.status} ${body}`);
  }
  return response.json();
}

async function walletPost(pathname, payload) {
  const response = await fetch(`http://127.0.0.1:${walletPort}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${pathname} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function getWalletSummary(address) {
  return walletGet("/api/wallet/summary", { address });
}

async function getWalletStatus(txHash) {
  return walletGet("/api/tx/status", { tx_hash: txHash });
}

async function getWalletReceipt(txHash) {
  const result = await walletGet("/api/tx/receipt", { tx_hash: txHash });
  return result.notFound ? null : result;
}

async function getValidator(address) {
  return walletGet("/api/system/validator", { address });
}

async function getStakes(params = {}) {
  return walletGet("/api/system/stakes", params);
}

async function getCheckpoints(limit = 20) {
  return walletGet("/api/system/checkpoints", { limit });
}

async function getValidatorSet() {
  return walletGet("/api/system/validator-set");
}

async function walletSend({
  nonce,
  from,
  to = receiverAddress,
  sendAmount = amount,
  privateKey = senderSeed,
}) {
  return walletPost("/api/tx/send", {
    from,
    to,
    amount: sendAmount,
    fee,
    nonce,
    privateKey,
  });
}

async function walletStakeRegister({
  nonce,
  from = senderAddress,
  privateKey = senderSeed,
  consensusPublicKey,
} = {}) {
  return walletPost("/api/tx/staking/register", {
    from,
    fee,
    nonce,
    privateKey,
    consensusPublicKey,
  });
}

async function walletStakeBond({
  nonce,
  from = senderAddress,
  privateKey = senderSeed,
  validatorAddress = senderAddress,
  bondAmount = "11",
} = {}) {
  return walletPost("/api/tx/staking/bond", {
    from,
    validatorAddress,
    amount: bondAmount,
    fee,
    nonce,
    privateKey,
  });
}

async function walletStakeUnbond({
  nonce,
  from = senderAddress,
  privateKey = senderSeed,
  validatorAddress = senderAddress,
} = {}) {
  return walletPost("/api/tx/staking/unbond", {
    from,
    validatorAddress,
    fee,
    nonce,
    privateKey,
  });
}

async function walletStakeUnbondFinalize({
  nonce,
  from = senderAddress,
  privateKey = senderSeed,
  validatorAddress = senderAddress,
} = {}) {
  return walletPost("/api/tx/staking/unbond-finalize", {
    from,
    validatorAddress,
    fee,
    nonce,
    privateKey,
  });
}

async function walletStakeRewardClaim({
  nonce,
  from = senderAddress,
  privateKey = senderSeed,
  validatorAddress = senderAddress,
} = {}) {
  return walletPost("/api/tx/staking/reward-claim", {
    from,
    validatorAddress,
    fee,
    nonce,
    privateKey,
  });
}

async function getPendingTxMap() {
  const result = await jsonRpc("get_pending_transactions", { address: senderAddress });
  return new Map(result.map((tx) => [tx.hash, tx]));
}

async function getTransaction(txHash) {
  return jsonRpc("get_transaction", { tx_hash: txHash });
}

async function startNode() {
  const node = selectNodeCommand();
  nodeProc = spawnManagedProcess(node.command, node.args, {
    cwd: chainRoot,
    env: {
      ...process.env,
      CERA_DATA_DIR: testDataDir,
      CERA_RPC_PORT: String(rpcPort),
      CERA_P2P_PORT: String(p2pPort),
      CERA_MINING_INTERVAL_SECS: String(miningIntervalSecs),
      CERA_STARTUP_TEST_TXS_MODE: "off",
    },
    stdoutPath: nodeLogs.stdout,
    stderrPath: nodeLogs.stderr,
  });

  await waitFor("chain health", async () => {
    const latest = await jsonRpc("get_latest_block", {});
    return latest;
  });

  assertStep(
    "启动 cera-chain",
    `RPC 在 ${rpcPort} 可用`,
    { pid: nodeProc.pid, rpcPort, dataDir: testDataDir },
    true
  );
}

async function stopNode() {
  if (!nodeProc || nodeProc.killed) {
    return;
  }
  nodeProc.kill();
  await new Promise((resolve) => nodeProc.once("exit", resolve));
}

async function restartNode() {
  await stopNode();
  await sleep(1500);
  await startNode();
}

async function startWallet() {
  const wallet = selectWalletCommand();
  walletProc = spawnManagedProcess(wallet.command, wallet.args, {
    cwd: walletRoot,
    env: {
      ...process.env,
      PORT: String(walletPort),
      RPC_URL: `http://127.0.0.1:${rpcPort}`,
      ALLOW_INSECURE_DEV_KEY_BODY: "true",
    },
    stdoutPath: walletLogs.stdout,
    stderrPath: walletLogs.stderr,
  });

  await waitFor("wallet health", async () => {
    const health = await walletGet("/api/health");
    return health?.ok === true ? health : null;
  });

  assertStep(
    "启动 cera-wallet",
    `HTTP API 在 ${walletPort} 可用`,
    { pid: walletProc.pid, walletPort, rpcUrl: `http://127.0.0.1:${rpcPort}` },
    true
  );
}

async function stopWallet() {
  if (!walletProc || walletProc.killed) {
    return;
  }
  walletProc.kill();
  await new Promise((resolve) => walletProc.once("exit", resolve));
}

async function verifyStatusFlow(txHash) {
  const pendingStatus = await getWalletStatus(txHash);
  assertStep(
    "验证交易初始状态",
    "钱包状态为 pending",
    pendingStatus,
    pendingStatus.status === "pending"
  );

  const includedTx = await waitFor(
    `chain included for ${txHash}`,
    async () => {
      const tx = await getTransaction(txHash);
      return tx?.status === "included" ? tx : null;
    },
    30_000,
    1000
  );
  assertStep(
    "验证交易进入区块",
    "chain get_transaction.status = included",
    includedTx,
    includedTx.status === "included"
  );

  const receipt = await waitFor(
    `wallet receipt for ${txHash}`,
    async () => {
      const rec = await getWalletReceipt(txHash);
      return rec?.block_height ? rec : null;
    },
    30_000,
    1000
  );
  assertStep(
    "验证 receipt 生成",
    "wallet receipt 返回 block_height",
    receipt,
    typeof receipt.block_height === "number"
  );

  const confirmedStatus = await getWalletStatus(txHash);
  assertStep(
    "验证交易最终状态",
    "钱包状态为 confirmed",
    confirmedStatus,
    confirmedStatus.status === "confirmed"
  );

  assertStep(
    "验证状态流转",
    "pending -> included -> confirmed",
    {
      tx_hash: txHash,
      flow: ["pending", "included", "confirmed"],
    },
    true
  );

  return { includedTx, receipt };
}

async function waitForStakeStatus(address, expectedStatus) {
  return waitFor(
    `stake status ${expectedStatus} for ${address}`,
    async () => {
      const stakes = await getStakes({ staker_address: address, limit: 20 });
      const match = stakes?.stakes?.find(
        (stake) =>
          stake.staker_address === address &&
          stake.validator_address === address &&
          stake.status === expectedStatus
      );
      return match ? { stakes, match } : null;
    },
    30_000,
    1000
  );
}

async function waitForStakePosition({ stakerAddress, validatorAddress, expectedStatus }) {
  return waitFor(
    `stake status ${expectedStatus} for staker=${stakerAddress} validator=${validatorAddress}`,
    async () => {
      const stakes = await getStakes({ staker_address: stakerAddress, limit: 20 });
      const match = stakes?.stakes?.find(
        (stake) =>
          stake.staker_address === stakerAddress &&
          stake.validator_address === validatorAddress &&
          stake.status === expectedStatus
      );
      return match ? { stakes, match } : null;
    },
    30_000,
    1000
  );
}

async function main() {
  try {
    await cleanupDir();
    await startNode();
    await startWallet();

    const initialSummary = await getWalletSummary(senderAddress);
    assertStep(
      "读取初始 summary",
      "获取 sender 的 next_nonce 和 available",
      initialSummary,
      typeof initialSummary.next_nonce === "number" && typeof initialSummary.available === "string"
    );

    const normalTx = await walletSend({});
    assertStep(
      "发送正常交易（连续 nonce）",
      'send_transaction 返回 mempool_status = "pending"',
      normalTx,
      normalTx.mempool_status === "pending" && typeof normalTx.tx_hash === "string"
    );

    await verifyStatusFlow(normalTx.tx_hash);

    const summaryAfterNormal = await getWalletSummary(senderAddress);
    const baseNonce = summaryAfterNormal.next_nonce;
    assertStep(
      "读取 gap 场景基准 nonce",
      "获得新的 next_nonce 作为补洞基准",
      { next_nonce: baseNonce },
      Number.isInteger(baseNonce) && baseNonce > 0
    );

    const futureTxA = await walletSend({
      from: senderAddress,
      nonce: baseNonce + 1,
      sendAmount: "1",
    });
    assertStep(
      "发送跳跃 nonce 交易 A",
      '返回 mempool_status = "future"',
      futureTxA,
      futureTxA.mempool_status === "future"
    );

    const futureTxB = await walletSend({
      from: senderAddress,
      nonce: baseNonce + 2,
      sendAmount: "1",
    });
    assertStep(
      "发送跳跃 nonce 交易 B",
      '返回 mempool_status = "future"',
      futureTxB,
      futureTxB.mempool_status === "future"
    );

    const pendingBeforeGap = await getPendingTxMap();
    const futureStatuses = {
      [futureTxA.tx_hash]: pendingBeforeGap.get(futureTxA.tx_hash)?.mempool_status,
      [futureTxB.tx_hash]: pendingBeforeGap.get(futureTxB.tx_hash)?.mempool_status,
    };
    assertStep(
      "验证跳跃 nonce 进入 future",
      "chain get_pending_transactions 中两笔交易都标记为 future",
      futureStatuses,
      futureStatuses[futureTxA.tx_hash] === "future" &&
        futureStatuses[futureTxB.tx_hash] === "future"
    );

    const futureStatusView = await getWalletStatus(futureTxA.tx_hash);
    assertStep(
      "验证 future 交易对钱包状态可见",
      "钱包状态仍为 pending（在 mempool 中）",
      futureStatusView,
      futureStatusView.status === "pending"
    );

    const gapFillTx = await walletSend({
      from: senderAddress,
      nonce: baseNonce,
      sendAmount: "1",
    });
    assertStep(
      "发送补洞交易",
      '补洞交易返回 mempool_status = "pending"',
      gapFillTx,
      gapFillTx.mempool_status === "pending"
    );

    const pendingAfterGap = await waitFor(
      "future promotion after gap fill",
      async () => {
        const map = await getPendingTxMap();
        const statuses = {
          [gapFillTx.tx_hash]: map.get(gapFillTx.tx_hash)?.mempool_status,
          [futureTxA.tx_hash]: map.get(futureTxA.tx_hash)?.mempool_status,
          [futureTxB.tx_hash]: map.get(futureTxB.tx_hash)?.mempool_status,
        };
        return Object.values(statuses).every((value) => value === "pending") ? statuses : null;
      },
      10_000,
      500
    );
    assertStep(
      "验证 future -> pending promote",
      "补洞后 gapFill/futureA/futureB 三笔都应为 pending",
      pendingAfterGap,
      true
    );

    const promotedReceipt = await waitFor(
      `receipt for promoted tx ${futureTxA.tx_hash}`,
      async () => {
        const rec = await getWalletReceipt(futureTxA.tx_hash);
        return rec?.block_height ? rec : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 promoted 交易最终生成 receipt",
      "future 交易在补洞后也应确认并拿到 block_height",
      promotedReceipt,
      typeof promotedReceipt.block_height === "number"
    );

    const stakingBaseSummary = await getWalletSummary(senderAddress);
    const stakingBaseNonce = stakingBaseSummary.next_nonce;
    const stakingAvailableBeforeBond = BigInt(stakingBaseSummary.available);
    assertStep(
      "读取 staking 基准 summary",
      "获得 staking 起始 nonce 与 available",
      {
        next_nonce: stakingBaseNonce,
        available: stakingBaseSummary.available,
      },
      Number.isInteger(stakingBaseNonce) && typeof stakingBaseSummary.available === "string"
    );

    const registerTx = await walletStakeRegister({
      from: senderAddress,
      nonce: stakingBaseNonce,
    });
    assertStep(
      "发送 validator_register",
      '返回 mempool_status = "pending"',
      registerTx,
      registerTx.mempool_status === "pending"
    );
    await verifyStatusFlow(registerTx.tx_hash);

    const validatorView = await waitFor(
      `validator registration for ${senderAddress}`,
      async () => {
        const validator = await getValidator(senderAddress);
        return validator?.found === true ? validator : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 validator_register 落地",
      "钱包系统视图中该地址应变为已注册 validator",
      validatorView,
      validatorView.found === true && validatorView.validator.validator_address === senderAddress
    );

    const secondSummary = await getWalletSummary(secondAddress);
    assertStep(
      "è¯»å–ç¬¬äºŒ validator åŸºå‡† summary",
      "èŽ·å–ç¬¬äºŒæµ‹è¯•è´¦æˆ·çš„ next_nonce å’Œ available",
      {
        address: secondAddress,
        next_nonce: secondSummary.next_nonce,
        available: secondSummary.available,
      },
      typeof secondSummary.next_nonce === "number" && typeof secondSummary.available === "string"
    );

    const secondRegisterTx = await walletStakeRegister({
      from: secondAddress,
      privateKey: secondSeed,
      nonce: secondSummary.next_nonce,
    });
    assertStep(
      "å‘é€ç¬¬äºŒ validator_register",
      'è¿”å› mempool_status = "pending"',
      secondRegisterTx,
      secondRegisterTx.mempool_status === "pending"
    );
    await verifyStatusFlow(secondRegisterTx.tx_hash);

    const secondValidatorView = await waitFor(
      `validator registration for ${secondAddress}`,
      async () => {
        const validator = await getValidator(secondAddress);
        return validator?.found === true ? validator : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒ validator_register è½åœ°",
      "ç¬¬äºŒæµ‹è¯•è´¦æˆ·åº”å˜ä¸ºå·²æ³¨å†Œ validator",
      secondValidatorView,
      secondValidatorView.found === true &&
        secondValidatorView.validator.validator_address === secondAddress
    );

    const bondTx = await walletStakeBond({
      from: senderAddress,
      nonce: stakingBaseNonce + 1,
      validatorAddress: senderAddress,
      bondAmount: "11",
    });
    assertStep(
      "发送 stake_bond",
      '返回 mempool_status = "pending"',
      bondTx,
      bondTx.mempool_status === "pending"
    );
    await verifyStatusFlow(bondTx.tx_hash);

    const bondedView = await waitForStakeStatus(senderAddress, "bonded");
    assertStep(
      "验证 stake_bond 进入 bonded",
      "stakes 视图中应出现 bonded stake position",
      bondedView.match,
      bondedView.match.status === "bonded" &&
        BigInt(String(bondedView.match.bonded_amount_base_units)) > 0n
    );

    const validatorSetAfterFirstBond = await waitFor(
      `validator set entry for ${senderAddress}`,
      async () => {
        const view = await getValidatorSet();
        const entry = view?.validator_set?.find(
          (item) => item.validator_address === senderAddress
        );
        return entry ? { view, entry } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬ä¸€ä¸ª bond å validator_set æ›´æ–°",
      "sender validator åº”å‡ºçŽ°åœ¨ validator_set ä¸­ï¼Œä¸”æœ‰æ­£ voting power",
      validatorSetAfterFirstBond.entry,
      BigInt(String(validatorSetAfterFirstBond.entry.effective_stake_base_units)) > 0n
    );

    const summaryAfterBond = await getWalletSummary(senderAddress);
    const availableAfterBond = BigInt(summaryAfterBond.available);
    assertStep(
      "验证 bond 后可用余额下降",
      "available 应小于 bond 前的 available",
      {
        before: stakingAvailableBeforeBond.toString(),
        after: availableAfterBond.toString(),
      },
      availableAfterBond < stakingAvailableBeforeBond
    );

    const secondBondTx = await walletStakeBond({
      from: senderAddress,
      nonce: stakingBaseNonce + 2,
      validatorAddress: secondAddress,
      bondAmount: "3",
    });
    assertStep(
      "å‘é€å¯¹ç¬¬äºŒ validator çš„ stake_bond",
      'è¿”å› mempool_status = "pending"',
      secondBondTx,
      secondBondTx.mempool_status === "pending"
    );
    await verifyStatusFlow(secondBondTx.tx_hash);

    const secondBondedView = await waitForStakePosition({
      stakerAddress: senderAddress,
      validatorAddress: secondAddress,
      expectedStatus: "bonded",
    });
    assertStep(
      "éªŒè¯ç¬¬äºŒ stake position è¿›å…¥ bonded",
      "åŒä¸€ staker å¯¹ç¬¬äºŒ validator çš„ stake position åº”ä¸º bonded",
      secondBondedView.match,
      secondBondedView.match.status === "bonded" &&
        secondBondedView.match.validator_address === secondAddress
    );

    const allSenderBonded = await waitFor(
      `multiple bonded stakes for ${senderAddress}`,
      async () => {
        const stakes = await getStakes({ staker_address: senderAddress, limit: 20 });
        const bonded = stakes?.stakes?.filter((stake) => stake.status === "bonded") ?? [];
        return bonded.length >= 2 ? { stakes, bonded } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯åŒä¸€ staker åŒæ—¶æŒæœ‰ä¸¤ä¸ª stake position",
      "sender åº”åŒæ—¶å¯¹ä¸¤ä¸ª validator æŒæœ‰ bonded positions",
      {
        bonded_positions: allSenderBonded.bonded.map((stake) => ({
          validator_address: stake.validator_address,
          status: stake.status,
        })),
      },
      allSenderBonded.bonded.some((stake) => stake.validator_address === senderAddress) &&
        allSenderBonded.bonded.some((stake) => stake.validator_address === secondAddress)
    );

    const rewardPreview = await waitFor(
      `pending reward for ${senderAddress}`,
      async () => {
        const stakes = await getStakes({ staker_address: senderAddress, limit: 20 });
        const bondedSelf = stakes?.stakes?.find(
          (stake) =>
            stake.staker_address === senderAddress &&
            stake.validator_address === senderAddress &&
            stake.status === "bonded"
        );
        if (!bondedSelf) {
          return null;
        }
        const pendingReward = BigInt(String(bondedSelf.pending_reward_display_units ?? "0"));
        return pendingReward > 0n ? { stakes, bondedSelf, pendingReward } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 bonded stake 出现待领取 reward",
      "sender -> senderAddress 的 bonded position 应出现 pending_reward_display_units > 0",
      {
        validator_address: rewardPreview.bondedSelf.validator_address,
        pending_reward_display_units: rewardPreview.pendingReward.toString(),
      },
      rewardPreview.pendingReward > 0n
    );

    const delegatedSmallBondRewardView = await getStakes({ staker_address: senderAddress, limit: 20 });
    const delegatedSmallBond = delegatedSmallBondRewardView?.stakes?.find(
      (stake) =>
        stake.staker_address === senderAddress &&
        stake.validator_address === secondAddress &&
        stake.status === "bonded"
    );
    assertStep(
      "验证小额 delegation 不会立刻产生 reward",
      "sender -> secondAddress 的 3 CERA bonded position 当前 pending_reward_display_units 应为 0",
      delegatedSmallBond
        ? {
            validator_address: delegatedSmallBond.validator_address,
            bonded_amount_base_units: delegatedSmallBond.bonded_amount_base_units,
            pending_reward_display_units: delegatedSmallBond.pending_reward_display_units,
          }
        : null,
      delegatedSmallBond != null &&
        BigInt(String(delegatedSmallBond.pending_reward_display_units ?? "0")) === 0n
    );

    const rewardClaimTx = await walletStakeRewardClaim({
      from: senderAddress,
      nonce: stakingBaseNonce + 3,
      validatorAddress: senderAddress,
    });
    assertStep(
      "发送 stake_reward_claim",
      '返回 mempool_status = "pending"',
      rewardClaimTx,
      rewardClaimTx.mempool_status === "pending"
    );
    await verifyStatusFlow(rewardClaimTx.tx_hash);

    const rewardCursorAfterClaim = await waitFor(
      `reward cursor refresh for ${senderAddress}`,
      async () => {
        const stakes = await getStakes({ staker_address: senderAddress, limit: 20 });
        const bondedSelf = stakes?.stakes?.find(
          (stake) =>
            stake.staker_address === senderAddress &&
            stake.validator_address === senderAddress &&
            stake.status === "bonded"
        );
        if (!bondedSelf) {
          return null;
        }
        const pendingReward = BigInt(String(bondedSelf.pending_reward_display_units ?? "0"));
        return pendingReward === 0n
          ? {
              pending_reward_display_units: pendingReward.toString(),
              reward_cursor_progress_height: bondedSelf.reward_cursor_progress_height,
            }
          : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 reward_claim 后奖励游标前移",
      "claim 后同一 bonded position 的 pending_reward_display_units 应回到 0",
      rewardCursorAfterClaim,
      rewardCursorAfterClaim.pending_reward_display_units === "0"
    );

    const wrongStakerUnbondSummary = await getWalletSummary(secondAddress);
    await expectFailure(
      "éªŒè¯é”™è¯¯ staker çš„ stake_unbond è¢«æ‹’ç»",
      'è¿”å› ERR_INVALID_STAKINGï¼Œä¸”æç¤º bonded stake position not found',
      async () =>
        walletStakeUnbond({
          from: secondAddress,
          privateKey: secondSeed,
          nonce: wrongStakerUnbondSummary.next_nonce,
          validatorAddress: secondAddress,
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("bonded stake position not found")
    );

    const validatorSetAfterSecondBond = await waitFor(
      `validator set entries for ${senderAddress} and ${secondAddress}`,
      async () => {
        const view = await getValidatorSet();
        const senderEntry = view?.validator_set?.find(
          (item) => item.validator_address === senderAddress
        );
        const secondEntry = view?.validator_set?.find(
          (item) => item.validator_address === secondAddress
        );
        return senderEntry && secondEntry ? { view, senderEntry, secondEntry } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒä¸ª bond å validator_set åŒæ—¶åŒ…å«ä¸¤ä¸ª validator",
      "validator_set åº”åŒæ—¶åŒ…å« sender å’Œ secondAddress ä¸¤ä¸ª entry",
      {
        sender: validatorSetAfterSecondBond.senderEntry,
        second: validatorSetAfterSecondBond.secondEntry,
      },
      BigInt(String(validatorSetAfterSecondBond.senderEntry.effective_stake_base_units)) > 0n &&
        BigInt(String(validatorSetAfterSecondBond.secondEntry.effective_stake_base_units)) > 0n
    );

    const unbondTx = await walletStakeUnbond({
      from: senderAddress,
      nonce: stakingBaseNonce + 4,
      validatorAddress: senderAddress,
    });
    assertStep(
      "发送 stake_unbond",
      '返回 mempool_status = "pending"',
      unbondTx,
      unbondTx.mempool_status === "pending"
    );
    await verifyStatusFlow(unbondTx.tx_hash);

    const unbondingView = await waitForStakeStatus(senderAddress, "unbonding");
    assertStep(
      "验证 stake_unbond 进入 unbonding",
      "stakes 视图中 bonded 应变为 unbonding",
      unbondingView.match,
      unbondingView.match.status === "unbonding" &&
        typeof unbondingView.match.unlock_requested_height === "number"
    );

    await expectFailure(
      "验证 stake_unbond_finalize 对错误 validator 被拒绝",
      '返回 ERR_INVALID_STAKING，且提示 unbonding stake position not found',
      async () =>
        walletStakeUnbondFinalize({
          from: senderAddress,
          nonce: stakingBaseNonce + 5,
          validatorAddress:
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("unbonding stake position not found")
    );

    await expectFailure(
      "éªŒè¯é‡å¤ stake_unbond è¢«æ‹’ç»",
      'è¿”å› ERR_INVALID_STAKINGï¼Œä¸”æç¤º bonded stake position not found',
      async () =>
        walletStakeUnbond({
          from: senderAddress,
          nonce: stakingBaseNonce + 5,
          validatorAddress: senderAddress,
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("bonded stake position not found")
    );

    const wrongStakerFinalizeSummary = await getWalletSummary(secondAddress);
    await expectFailure(
      "éªŒè¯é”™è¯¯ staker çš„ stake_unbond_finalize è¢«æ‹’ç»",
      'è¿”å› ERR_INVALID_STAKINGï¼Œä¸”æç¤º unbonding stake position not found',
      async () =>
        walletStakeUnbondFinalize({
          from: secondAddress,
          privateKey: secondSeed,
          nonce: wrongStakerFinalizeSummary.next_nonce,
          validatorAddress: senderAddress,
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("unbonding stake position not found")
    );

    const secondPositionAfterUnbond = await waitForStakePosition({
      stakerAddress: senderAddress,
      validatorAddress: secondAddress,
      expectedStatus: "bonded",
    });
    assertStep(
      "éªŒè¯ unbond ä¸å½±å“å¦ä¸€ä¸ª validator stake position",
      "å¯¹ senderAddress çš„ unbond ä¸åº”æ”¹å˜ secondAddress çš„ bonded position",
      secondPositionAfterUnbond.match,
      secondPositionAfterUnbond.match.status === "bonded" &&
        secondPositionAfterUnbond.match.validator_address === secondAddress
    );

    const validatorSetAfterUnbond = await waitFor(
      `validator set filtered after unbond for ${senderAddress}`,
      async () => {
        const view = await getValidatorSet();
        const senderEntry = view?.validator_set?.find(
          (item) => item.validator_address === senderAddress
        );
        const secondEntry = view?.validator_set?.find(
          (item) => item.validator_address === secondAddress
        );
        return !senderEntry && secondEntry ? { view, secondEntry } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ unbond å validator_set ç§»é™¤å¯¹åº” validator",
      "sender validator åº”ä»Ž validator_set ä¸­ç§»é™¤ï¼Œä½† secondAddress ä»åº”ä¿ç•™",
      {
        count: validatorSetAfterUnbond.view.count,
        validator_set: validatorSetAfterUnbond.view.validator_set,
      },
      validatorSetAfterUnbond.view.validator_set.every(
        (item) => item.validator_address !== senderAddress
      ) &&
        validatorSetAfterUnbond.view.validator_set.some(
          (item) => item.validator_address === secondAddress
        )
    );

    const finalizeReady = await waitFor(
      "height readiness for unbond finalize",
      async () => {
        const summaryNow = await getWalletSummary(senderAddress);
        const latestHeight = summaryNow?.block_height;
        const unlockHeight = unbondingView.match.unlock_requested_height;
        return typeof latestHeight === "number" && latestHeight >= unlockHeight + 1
          ? { block_height: latestHeight, unlock_requested_height: unlockHeight }
          : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 unbond finalize 条件满足",
      "wallet summary.block_height 应至少比 unlock_requested_height 大 1",
      finalizeReady,
      finalizeReady.block_height >= finalizeReady.unlock_requested_height + 1
    );

    const finalizeTx = await walletStakeUnbondFinalize({
      from: senderAddress,
      nonce: stakingBaseNonce + 5,
      validatorAddress: senderAddress,
    });
    assertStep(
      "发送 stake_unbond_finalize",
      '返回 mempool_status = "pending"',
      finalizeTx,
      finalizeTx.mempool_status === "pending"
    );
    await verifyStatusFlow(finalizeTx.tx_hash);

    const stakesAfterFinalize = await waitFor(
      `stake finalize removal for ${senderAddress}`,
      async () => {
        const stakes = await getStakes({ staker_address: senderAddress, limit: 20 });
        const remaining = stakes?.stakes?.find(
          (stake) =>
            stake.staker_address === senderAddress && stake.validator_address === senderAddress
        );
        return !remaining ? stakes : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证 finalize 后 stake position 被移除",
      "同一 staker/validator 的 stake position 应消失",
      stakesAfterFinalize,
      Array.isArray(stakesAfterFinalize.stakes) &&
        !stakesAfterFinalize.stakes.some(
          (stake) =>
            stake.staker_address === senderAddress && stake.validator_address === senderAddress
        )
    );

    const secondPositionAfterFinalize = await waitForStakePosition({
      stakerAddress: senderAddress,
      validatorAddress: secondAddress,
      expectedStatus: "bonded",
    });
    assertStep(
      "éªŒè¯ finalize ä¸å½±å“å¦ä¸€ä¸ª validator stake position",
      "å¯¹ senderAddress çš„ finalize ä¸åº”ç§»é™¤ secondAddress çš„ bonded position",
      secondPositionAfterFinalize.match,
      secondPositionAfterFinalize.match.status === "bonded" &&
        secondPositionAfterFinalize.match.validator_address === secondAddress
    );

    const validatorSetAfterFinalize = await waitFor(
      `validator set after finalize for ${secondAddress}`,
      async () => {
        const view = await getValidatorSet();
        const senderEntry = view?.validator_set?.find(
          (item) => item.validator_address === senderAddress
        );
        const secondEntry = view?.validator_set?.find(
          (item) => item.validator_address === secondAddress
        );
        return !senderEntry && secondEntry ? { view, secondEntry } : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ finalize åŽ validator_set ä¿æŒæ­£ç¡®",
      "finalize åŽ validator_set ä»åº”åªä¿ç•™ secondAddress çš„ active stake entry",
      {
        count: validatorSetAfterFinalize.view.count,
        validator_set: validatorSetAfterFinalize.view.validator_set,
      },
      validatorSetAfterFinalize.view.validator_set.every(
        (item) => item.validator_address !== senderAddress
      ) &&
        validatorSetAfterFinalize.view.validator_set.some(
          (item) => item.validator_address === secondAddress
        )
    );

    const secondUnbondTx = await walletStakeUnbond({
      from: senderAddress,
      nonce: stakingBaseNonce + 6,
      validatorAddress: secondAddress,
    });
    assertStep(
      "å‘é€ç¬¬äºŒ stake_unbond",
      'è¿”å› mempool_status = "pending"',
      secondUnbondTx,
      secondUnbondTx.mempool_status === "pending"
    );
    await verifyStatusFlow(secondUnbondTx.tx_hash);

    const secondUnbondingView = await waitForStakePosition({
      stakerAddress: senderAddress,
      validatorAddress: secondAddress,
      expectedStatus: "unbonding",
    });
    assertStep(
      "éªŒè¯ç¬¬äºŒ stake position è¿›å…¥ unbonding",
      "secondAddress å¯¹åº”çš„ stake position åº”å˜ä¸º unbonding",
      secondUnbondingView.match,
      secondUnbondingView.match.status === "unbonding" &&
        typeof secondUnbondingView.match.unlock_requested_height === "number"
    );

    const validatorSetAfterSecondUnbond = await waitFor(
      `validator set empty after unbond for ${secondAddress}`,
      async () => {
        const view = await getValidatorSet();
        return view?.count === 0 ? view : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒ unbond åŽ validator_set æ¸…ç©º",
      "å½“ä¸¤ä¸ª validator éƒ½å¤„äºŽéž bonded çŠ¶æ€æ—¶ï¼Œvalidator_set åº”ä¸ºç©º",
      validatorSetAfterSecondUnbond,
      validatorSetAfterSecondUnbond.count === 0
    );

    const secondFinalizeReady = await waitFor(
      "height readiness for second unbond finalize",
      async () => {
        const summaryNow = await getWalletSummary(senderAddress);
        const latestHeight = summaryNow?.block_height;
        const unlockHeight = secondUnbondingView.match.unlock_requested_height;
        return typeof latestHeight === "number" && latestHeight >= unlockHeight + 1
          ? { block_height: latestHeight, unlock_requested_height: unlockHeight }
          : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒ unbond finalize æ¡ä»¶æ»¡è¶³",
      "wallet summary.block_height åº”è‡³å°‘æ¯”ç¬¬äºŒ unlock_requested_height å¤§ 1",
      secondFinalizeReady,
      secondFinalizeReady.block_height >= secondFinalizeReady.unlock_requested_height + 1
    );

    const secondFinalizeTx = await walletStakeUnbondFinalize({
      from: senderAddress,
      nonce: stakingBaseNonce + 7,
      validatorAddress: secondAddress,
    });
    assertStep(
      "å‘é€ç¬¬äºŒ stake_unbond_finalize",
      'è¿”å› mempool_status = "pending"',
      secondFinalizeTx,
      secondFinalizeTx.mempool_status === "pending"
    );
    await verifyStatusFlow(secondFinalizeTx.tx_hash);

    const allStakesAfterSecondFinalize = await waitFor(
      `all stake positions removed for ${senderAddress}`,
      async () => {
        const stakes = await getStakes({ staker_address: senderAddress, limit: 20 });
        return Array.isArray(stakes?.stakes) && stakes.stakes.length === 0 ? stakes : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒ finalize åŽæ‰€æœ‰ stake positions ç§»é™¤",
      "sender æ‰€æœ‰ validator stake positions éƒ½åº”æ¸…ç©º",
      allStakesAfterSecondFinalize,
      allStakesAfterSecondFinalize.count === 0
    );

    const validatorSetAfterSecondFinalize = await waitFor(
      `validator set empty after finalize for ${secondAddress}`,
      async () => {
        const view = await getValidatorSet();
        return view?.count === 0 ? view : null;
      },
      30_000,
      1000
    );
    assertStep(
      "éªŒè¯ç¬¬äºŒ finalize åŽ validator_set ä¿æŒä¸ºç©º",
      "å½“ä¸¤ä¸ª bonded positions éƒ½ finalize åŽï¼Œvalidator_set åº”ä¸ºç©º",
      validatorSetAfterSecondFinalize,
      validatorSetAfterSecondFinalize.count === 0
    );

    const summaryAfterFinalize = await getWalletSummary(senderAddress);
    const availableAfterFinalize = BigInt(summaryAfterFinalize.available);
    const stakingFeeTotal = BigInt(fee) * stakingActionCount;
    const rewardClaimTotal = rewardPreview.pendingReward;
    const expectedAvailableAfterFinalize =
      stakingAvailableBeforeBond - stakingFeeTotal + rewardClaimTotal;
    assertStep(
      "验证 finalize 后余额释放",
      "available 应返还 bond 本金，仅扣除 staking 手续费",
      {
        before_bond: stakingAvailableBeforeBond.toString(),
        after_bond: availableAfterBond.toString(),
        claimed_reward: rewardClaimTotal.toString(),
        after_finalize: availableAfterFinalize.toString(),
        expected_after_finalize: expectedAvailableAfterFinalize.toString(),
      },
      availableAfterFinalize === expectedAvailableAfterFinalize
    );

    const stakingBoundarySummary = await getWalletSummary(senderAddress);
    const boundaryNonce = stakingBoundarySummary.next_nonce;

    await expectFailure(
      "éªŒè¯é‡å¤ stake_unbond_finalize è¢«æ‹’ç»",
      'è¿”å› ERR_INVALID_STAKINGï¼Œä¸”æç¤º unbonding stake position not found',
      async () =>
        walletStakeUnbondFinalize({
          from: senderAddress,
          nonce: boundaryNonce,
          validatorAddress: senderAddress,
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("unbonding stake position not found")
    );

    assertStep(
      "读取 staking 边界场景 nonce",
      "获得负例验证用的 next_nonce",
      { next_nonce: boundaryNonce },
      Number.isInteger(boundaryNonce) && boundaryNonce > stakingBaseNonce + 7
    );

    await expectFailure(
      "验证重复 validator_register 被拒绝",
      '返回 ERR_INVALID_STAKING，且提示 validator already registered',
      async () =>
        walletStakeRegister({
          from: senderAddress,
          nonce: boundaryNonce,
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("validator already registered")
    );

    await expectFailure(
      "验证 stake_bond 到不存在 validator 被拒绝",
      '返回 ERR_INVALID_STAKING，且提示 stake target validator not found',
      async () =>
        walletStakeBond({
          from: senderAddress,
          nonce: boundaryNonce,
          validatorAddress:
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          bondAmount: "3",
        }),
      (message) =>
        message.includes("ERR_INVALID_STAKING") &&
        message.includes("stake target validator not found")
    );

    await restartNode();

    const receiptAfterRestart = await waitFor(
      `receipt after restart for ${normalTx.tx_hash}`,
      async () => {
        const rec = await getWalletReceipt(normalTx.tx_hash);
        return rec?.block_height ? rec : null;
      },
      30_000,
      1000
    );
    assertStep(
      "验证重启后一致性（receipt）",
      "节点重启后 receipt 仍可读取",
      receiptAfterRestart,
      typeof receiptAfterRestart.block_height === "number"
    );

    const statusAfterRestart = await getWalletStatus(normalTx.tx_hash);
    assertStep(
      "验证重启后一致性（status）",
      "节点重启后钱包状态仍为 confirmed",
      statusAfterRestart,
      statusAfterRestart.status === "confirmed"
    );

    printDivider();
    console.log(`测试完成: PASS=${summary.pass}, FAIL=${summary.fail}`);
    console.log(`日志目录: ${currentRunDir}`);
    process.exitCode = 0;
  } catch (error) {
    printDivider();
    console.error("测试中断:", error);
    console.error(`日志目录: ${currentRunDir}`);
    process.exitCode = 1;
  } finally {
    await stopWallet();
    await stopNode();
  }
}

await main();
