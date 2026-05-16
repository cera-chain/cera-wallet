import type { Request, Response } from "express";
import type { AccountService } from "../services/account.service.js";
import { formatRpcOrTxError } from "../services/tx.service.js";

export function createAccountController(accounts: AccountService) {
  return {
    async createWallet(req: Request, res: Response) {
      try {
        const result = await accounts.createWallet({
          keyMaterialRef:
            req.body?.keyMaterialRef !== undefined
              ? String(req.body.keyMaterialRef)
              : undefined,
        });
        res.json(result);
      } catch (error) {
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async createMnemonicWallet(req: Request, res: Response) {
      try {
        res.status(410).json({
          error: "SERVER_MNEMONIC_GENERATION_DISABLED",
          message:
            "Server-side mnemonic generation is disabled. Generate the wallet locally and register public wallet metadata instead.",
        });
      } catch (error) {
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async importPrivateKeyWallet(req: Request, res: Response) {
      try {
        const privateKey = String(req.body?.privateKey ?? "").trim();
        if (!privateKey) {
          res.status(400).json({ error: "privateKey is required" });
          return;
        }

        const result = await accounts.importPrivateKeyWallet({
          privateKey,
          keyMaterialRef:
            req.body?.keyMaterialRef !== undefined
              ? String(req.body.keyMaterialRef)
              : undefined,
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "privateKey must be 64 hex chars (32-byte Ed25519 seed)"
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async importMnemonicWallet(req: Request, res: Response) {
      try {
        const mnemonic = String(req.body?.mnemonic ?? "").trim();
        if (!mnemonic) {
          res.status(400).json({ error: "mnemonic is required" });
          return;
        }

        const result = await accounts.importMnemonicWallet({
          mnemonic,
          keyMaterialRef:
            req.body?.keyMaterialRef !== undefined
              ? String(req.body.keyMaterialRef)
              : undefined,
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "mnemonic must be a valid 24-word BIP39 English mnemonic"
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async register(req: Request, res: Response) {
      try {
        const result = await accounts.registerAccount({
          ceraAddress: String(req.body?.ceraAddress ?? "").trim(),
          keyMaterialRef:
            req.body?.keyMaterialRef !== undefined
              ? String(req.body.keyMaterialRef)
              : undefined,
          pqKeyMaterialRef:
            req.body?.pqKeyMaterialRef !== undefined
              ? String(req.body.pqKeyMaterialRef)
              : undefined,
          accountType:
            req.body?.accountType !== undefined
              ? String(req.body.accountType)
              : undefined,
          authMode:
            req.body?.authMode !== undefined
              ? String(req.body.authMode)
              : undefined,
          ed25519PublicKey:
            req.body?.ed25519PublicKey !== undefined
              ? String(req.body.ed25519PublicKey)
              : undefined,
          pqPublicKey:
            req.body?.pqPublicKey !== undefined
              ? String(req.body.pqPublicKey)
              : undefined,
          pqKeyId:
            req.body?.pqKeyId !== undefined
              ? String(req.body.pqKeyId)
              : undefined,
          migrationVersion:
            req.body?.migrationVersion !== undefined
              ? Number(req.body.migrationVersion)
              : undefined,
          derivationScheme:
            req.body?.derivationScheme !== undefined
              ? String(req.body.derivationScheme)
              : undefined,
          derivationPath:
            req.body?.derivationPath !== undefined
              ? String(req.body.derivationPath)
              : undefined,
          coinType:
            req.body?.coinType !== undefined ? Number(req.body.coinType) : undefined,
          accountIndex:
            req.body?.accountIndex !== undefined
              ? Number(req.body.accountIndex)
              : undefined,
          addressIndex:
            req.body?.addressIndex !== undefined
              ? Number(req.body.addressIndex)
              : undefined,
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "ceraAddress is required"
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async profile(req: Request, res: Response) {
      try {
        const result = await accounts.getAccountProfile({
          ceraAddress: String(
            req.body?.ceraAddress ?? req.query?.ceraAddress ?? req.query?.address ?? ""
          ).trim(),
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "ceraAddress is required"
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async prepareHybridMigration(req: Request, res: Response) {
      try {
        const result = await accounts.prepareHybridMigration({
          ceraAddress: String(req.body?.ceraAddress ?? "").trim(),
          pqPublicKey: String(req.body?.pqPublicKey ?? "").trim(),
          pqKeyMaterialRef:
            req.body?.pqKeyMaterialRef !== undefined
              ? String(req.body.pqKeyMaterialRef)
              : undefined,
          pqKeyId:
            req.body?.pqKeyId !== undefined
              ? String(req.body.pqKeyId)
              : undefined,
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
            (error.message === "pqPublicKey is required" ||
            error.message === "ceraAddress is required" ||
            error.message === "account not found")
        ) {
          res
            .status(error.message === "account not found" ? 404 : 400)
            .json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },

    async postQuantumReadiness(req: Request, res: Response) {
      try {
        const result = await accounts.getPostQuantumReadiness({
          ceraAddress: String(
            req.body?.ceraAddress ?? req.query?.ceraAddress ?? req.query?.address ?? ""
          ).trim(),
        });
        res.json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "ceraAddress is required"
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        const { status, body } = formatRpcOrTxError(error);
        res.status(status).json(body);
      }
    },
  };
}
