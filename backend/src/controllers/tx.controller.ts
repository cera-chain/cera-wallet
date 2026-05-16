import type { Request, Response } from "express";
import type { TxService } from "../services/tx.service.js";
import { formatRpcOrTxError } from "../services/tx.service.js";
import { toDisplayAddress } from "../utils/address.js";

function isHexAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function createTxController(tx: TxService) {
  async function submitSignedBody(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      if (
        body.privateKey !== undefined ||
        body.pqPrivateKey !== undefined ||
        body.mnemonic !== undefined ||
        body.seed !== undefined
      ) {
        res.status(400).json({
          error: "CLIENT_SECRET_REJECTED",
          message:
            "Submit only signed transaction fields. Private keys, PQ private keys, seeds, and mnemonics must stay in the browser.",
        });
        return;
      }

      const result = await tx.submitSignedTransaction(body);
      res.json(result);
    } catch (error) {
      const { status, body } = formatRpcOrTxError(error);
      res.status(status).json(body);
    }
  }

  return {
    async stakingRegister(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    async stakingBond(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    async stakingUnbond(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    async stakingUnbondFinalize(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    async stakingRewardClaim(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    /**
     * body: { from?, to, amount, privateKey, pqPrivateKey?, fee?, nonce? }
     * privateKey：Ed25519 种子，64 位 hex（可选 0x 前缀）。生产环境勿在公网明文传输。
     * pqPrivateKey：ML-DSA 种子，64 位 hex（hybrid 账户可选）。
     */
    async send(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    async migrateHybrid(req: Request, res: Response) {
      await submitSignedBody(req, res);
    },

    /**
     * GET /api/tx/receipt?tx_hash=0x...
     * 来自节点持久化 `get_receipt`；无记录 **404**。
     * 对外只暴露 `block_height`。
     */
    async receipt(req: Request, res: Response) {
      try {
        const q = req.query.tx_hash ?? req.query.hash;
        const tx_hash =
          q === undefined || q === null ? "" : Array.isArray(q) ? String(q[0]) : String(q);
        if (!tx_hash.trim()) {
          res.status(400).json({ error: "tx_hash query param is required" });
          return;
        }
        const rec = await tx.getStoredReceipt(tx_hash);
        if (rec === null) {
          res.status(404).json({ error: "RECEIPT_NOT_FOUND", tx_hash: tx_hash.trim() });
          return;
        }
        res.json({
          tx_hash: rec.tx_hash,
          block_height: rec.block_height,
          status: rec.status,
          from: toDisplayAddress(rec.from),
          to: toDisplayAddress(rec.to),
          amount: rec.amount,
          gas_used: rec.gas_used,
          logs: rec.logs,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "tx_hash is required") {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    /**
     * GET /api/tx/status?tx_hash=0x...
     * 响应：`{ tx_hash, status }`，`pending` | `included` | `confirmed` | `not_found`
     */
    async status(req: Request, res: Response) {
      try {
        const q = req.query.tx_hash ?? req.query.hash;
        const tx_hash =
          q === undefined || q === null ? "" : Array.isArray(q) ? String(q[0]) : String(q);
        if (!tx_hash.trim()) {
          res.status(400).json({ error: "tx_hash query param is required" });
          return;
        }
        const result = await tx.getTxStatus(tx_hash);
        res.json(result);
      } catch (error) {
        if (error instanceof Error && error.message === "tx_hash is required") {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },
  };
}
