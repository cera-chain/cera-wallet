import { Router } from "express";
import type { DatabasePool } from "../db/pool.js";
import type { RpcClient } from "../rpc/client.js";
import { createAccountController } from "../controllers/account.controller.js";
import { createWalletService } from "../services/wallet.service.js";
import { createAccountService } from "../services/account.service.js";
import { createTxService } from "../services/tx.service.js";
import { createWalletController } from "../controllers/wallet.controller.js";
import { createTxController } from "../controllers/tx.controller.js";

export function createApiRouter(
  rpc: RpcClient,
  options: { database?: DatabasePool } = {}
): Router {
  const router = Router();
  const wallet = createWalletService(rpc);
  const accounts = createAccountService(rpc, { database: options.database });
  const tx = createTxService(rpc);
  const walletCtrl = createWalletController(wallet);
  const accountCtrl = createAccountController(accounts);
  const txCtrl = createTxController(tx);

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "cera-wallet-backend" });
  });

  router.get("/wallet/summary", (req, res) => void walletCtrl.summary(req, res));
  router.post("/wallet/summary", (req, res) => void walletCtrl.summary(req, res));

  router.get("/wallet/pending", (req, res) => void walletCtrl.pending(req, res));
  router.post("/wallet/pending", (req, res) => void walletCtrl.pending(req, res));
  router.get("/system/fork-choice-status", (req, res) => void walletCtrl.forkChoiceStatus(req, res));
  router.get("/system/validator", (req, res) => void walletCtrl.validator(req, res));
  router.get("/system/validator-set", (req, res) => void walletCtrl.validatorSet(req, res));
  router.get("/system/stakes", (req, res) => void walletCtrl.stakes(req, res));
  router.get("/system/staking-policy", (req, res) => void walletCtrl.stakingPolicy(req, res));
  router.get("/system/checkpoints", (req, res) => void walletCtrl.checkpoints(req, res));
  router.get("/system/finalized", (req, res) => void walletCtrl.finalized(req, res));
  router.get("/wallet/account", (req, res) => void accountCtrl.profile(req, res));
  router.get(
    "/wallet/account/post-quantum-readiness",
    (req, res) => void accountCtrl.postQuantumReadiness(req, res)
  );
  router.post("/wallet/account/create", (req, res) => void accountCtrl.createWallet(req, res));
  router.post(
    "/wallet/account/create-mnemonic",
    (req, res) => void accountCtrl.createMnemonicWallet(req, res)
  );
  router.post(
    "/wallet/account/import-private-key",
    (req, res) => void accountCtrl.importPrivateKeyWallet(req, res)
  );
  router.post(
    "/wallet/account/import-mnemonic",
    (req, res) => void accountCtrl.importMnemonicWallet(req, res)
  );
  router.post("/wallet/account/register", (req, res) => void accountCtrl.register(req, res));
  router.post("/wallet/account/register-wallet", (req, res) => void accountCtrl.register(req, res));
  router.post(
    "/wallet/account/prepare-hybrid-migration",
    (req, res) => void accountCtrl.prepareHybridMigration(req, res)
  );

  router.post("/tx/send", (req, res) => void txCtrl.send(req, res));
  router.post("/tx/staking/register", (req, res) => void txCtrl.stakingRegister(req, res));
  router.post("/tx/staking/bond", (req, res) => void txCtrl.stakingBond(req, res));
  router.post("/tx/staking/unbond", (req, res) => void txCtrl.stakingUnbond(req, res));
  router.post("/tx/staking/unbond-finalize", (req, res) => void txCtrl.stakingUnbondFinalize(req, res));
  router.post("/tx/staking/reward-claim", (req, res) => void txCtrl.stakingRewardClaim(req, res));
  router.post("/tx/migrate-hybrid", (req, res) => void txCtrl.migrateHybrid(req, res));
  router.get("/tx/receipt", (req, res) => void txCtrl.receipt(req, res));
  router.get("/tx/status", (req, res) => void txCtrl.status(req, res));

  return router;
}
