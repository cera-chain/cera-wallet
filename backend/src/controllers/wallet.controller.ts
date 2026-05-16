import type { Request, Response } from "express";
import type { WalletService } from "../services/wallet.service.js";
import { formatRpcOrTxError } from "../services/tx.service.js";

export function createWalletController(wallet: WalletService) {
  return {
    async summary(req: Request, res: Response) {
      try {
        const address = String(req.body?.address ?? req.query?.address ?? "").trim();
        if (!address) {
          res.status(400).json({ error: "INVALID_PARAMS", message: "address required" });
          return;
        }
        const data = await wallet.getBalanceView(address);
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async pending(req: Request, res: Response) {
      try {
        const address = String(req.body?.address ?? req.query?.address ?? "").trim();
        if (!address) {
          res.status(400).json({ error: "INVALID_PARAMS", message: "address required" });
          return;
        }
        const list = await wallet.getPendingTransactions(address);
        res.json({ address, pending: list });
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async forkChoiceStatus(_req: Request, res: Response) {
      try {
        const data = await wallet.getForkChoiceStatus();
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async validatorSet(_req: Request, res: Response) {
      try {
        const data = await wallet.getValidatorSet();
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async validator(req: Request, res: Response) {
      try {
        const address = String(req.query?.address ?? "").trim();
        if (!address) {
          res.status(400).json({ error: "INVALID_PARAMS", message: "address required" });
          return;
        }
        const data = await wallet.getValidator(address);
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async stakes(req: Request, res: Response) {
      try {
        const validator_address = String(req.query?.validator_address ?? "").trim();
        const staker_address = String(req.query?.staker_address ?? "").trim();
        const limit = Number.parseInt(String(req.query?.limit ?? "50"), 10);
        const data = await wallet.getStakes({
          validator_address: validator_address || undefined,
          staker_address: staker_address || undefined,
          limit: Number.isFinite(limit) ? limit : 50,
        });
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async stakingPolicy(_req: Request, res: Response) {
      try {
        const data = await wallet.getStakingPolicy();
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async checkpoints(req: Request, res: Response) {
      try {
        const limit = Number.parseInt(String(req.query?.limit ?? "20"), 10);
        const data = await wallet.getCheckpoints(Number.isFinite(limit) ? limit : 20);
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },

    async finalized(_req: Request, res: Response) {
      try {
        const data = await wallet.getLatestFinalizedCheckpoint();
        res.json(data);
      } catch (e) {
        const { status, body } = formatRpcOrTxError(e);
        res.status(status).json(body);
      }
    },
  };
}
