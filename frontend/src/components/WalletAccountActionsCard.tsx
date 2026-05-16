import { useState } from "react";
import type {
  ApiError,
  WalletAccountProfile
} from "../types/api";
import { registerWalletAccount } from "../services/wallet";
import {
  buildWalletRegistrationPayload,
  createLocalMnemonicWallet,
  createLocalPrivateKeyWallet,
  importLocalMnemonicWallet,
  importLocalPrivateKeyWallet,
  type LocalWalletMaterial
} from "../services/local-wallet";

type WalletAccountActionsCardProps = {
  onAddressSelected: (address: string) => void;
};

type RegisteredLocalWalletResult = LocalWalletMaterial & {
  account: WalletAccountProfile | null;
};

type AccountActionResult =
  | { kind: "created"; data: RegisteredLocalWalletResult }
  | { kind: "created-mnemonic"; data: RegisteredLocalWalletResult }
  | { kind: "imported"; data: RegisteredLocalWalletResult }
  | { kind: "imported-mnemonic"; data: RegisteredLocalWalletResult };

export function WalletAccountActionsCard({
  onAddressSelected
}: WalletAccountActionsCardProps) {
  const [privateKey, setPrivateKey] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [loading, setLoading] = useState<
    "create" | "create-mnemonic" | "import" | "import-mnemonic" | null
  >(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<AccountActionResult | null>(null);
  const [backupChecked, setBackupChecked] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  async function registerLocalWallet(wallet: LocalWalletMaterial): Promise<RegisteredLocalWalletResult> {
    const account = await registerWalletAccount(buildWalletRegistrationPayload(wallet));
    return {
      ...wallet,
      account
    };
  }

  async function handleCreate() {
    setLoading("create");
    setError(null);

    try {
      const data = await registerLocalWallet(createLocalPrivateKeyWallet());
      setBackupChecked(false);
      setBackupConfirmed(false);
      setResult({ kind: "created", data });
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(null);
    }
  }

  async function handleImport() {
    setLoading("import");
    setError(null);

    try {
      const data = await registerLocalWallet(importLocalPrivateKeyWallet(privateKey.trim()));
      setBackupChecked(false);
      setBackupConfirmed(false);
      setResult({ kind: "imported", data });
      onAddressSelected(data.address);
      setPrivateKey("");
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(null);
    }
  }

  async function handleCreateMnemonic() {
    setLoading("create-mnemonic");
    setError(null);

    try {
      const data = await registerLocalWallet(createLocalMnemonicWallet());
      setBackupChecked(false);
      setBackupConfirmed(false);
      setResult({ kind: "created-mnemonic", data });
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(null);
    }
  }

  async function handleImportMnemonic() {
    setLoading("import-mnemonic");
    setError(null);

    try {
      const data = await registerLocalWallet(importLocalMnemonicWallet(mnemonic.trim()));
      setBackupChecked(false);
      setBackupConfirmed(false);
      setResult({ kind: "imported-mnemonic", data });
      onAddressSelected(data.address);
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(null);
    }
  }

  function handleConfirmBackup() {
    if (
      (result?.kind !== "created" && result?.kind !== "created-mnemonic") ||
      !backupChecked
    ) {
      return;
    }
    setBackupConfirmed(true);
    onAddressSelected(result.data.address);
  }

  const address = result?.data.address ?? null;
  const publicKey = result?.data.publicKey ?? null;
  const createdWalletNeedsBackup =
    result?.kind === "created" || result?.kind === "created-mnemonic";
  const needsBackupConfirmation = createdWalletNeedsBackup && !backupConfirmed;
  const returnedPrivateKey = needsBackupConfirmation ? result.data.privateKey : null;
  const returnedMnemonic =
    result?.kind === "created-mnemonic" && needsBackupConfirmation
      ? result.data.mnemonic
      : null;
  const backupConfirmationLabel =
    result?.kind === "created-mnemonic"
      ? "I have backed up the 24-word mnemonic and private key."
      : "I have backed up the private key.";
  const derivationPath =
    result?.kind === "created-mnemonic" || result?.kind === "imported-mnemonic"
      ? result.data.derivationPath
      : result?.data.account?.derivationPath ?? null;
  const account = result?.data.account ?? null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Create / Import Wallet</h2>
        <span className="muted">
          {needsBackupConfirmation ? "Backup required" : account ? "Registered by address" : "Local generation"}
        </span>
      </div>

      <div className="grid account-action-grid">
        <label className="field">
          <span>Private Key Import</span>
          <input
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            placeholder="0x + 64 hex seed"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      <label className="field mnemonic-field">
        <span>24-Word Mnemonic Import</span>
        <textarea
          value={mnemonic}
          onChange={(event) => setMnemonic(event.target.value)}
          placeholder="word1 word2 ... word24"
          rows={3}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <div className="actions account-actions">
        <button type="button" onClick={() => void handleCreateMnemonic()} disabled={loading !== null}>
          {loading === "create-mnemonic" ? "Creating..." : "Create 24-Word Wallet Locally"}
        </button>
        <button type="button" className="secondary" onClick={() => void handleCreate()} disabled={loading !== null}>
          {loading === "create" ? "Creating..." : "Create Wallet Locally"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void handleImport()}
          disabled={loading !== null || privateKey.trim().length === 0}
        >
          {loading === "import" ? "Importing..." : "Import Private Key"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void handleImportMnemonic()}
          disabled={loading !== null || mnemonic.trim().length === 0}
        >
          {loading === "import-mnemonic" ? "Importing..." : "Import Mnemonic"}
        </button>
      </div>

      {error ? (
        <div className="error-banner account-action-error">
          <strong>{error.code}</strong>
          <span>{error.message}</span>
        </div>
      ) : null}

      {result ? (
        <div className="grid stats-grid account-result-grid">
          <div className="stat-card accent">
            <span className="stat-label">Address</span>
            <strong className="mono-break">{address}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Public Key</span>
            <strong className="mono-break">{publicKey}</strong>
          </div>
          {returnedPrivateKey ? (
            <div className="stat-card private-key-card">
              <span className="stat-label">Private Key</span>
              <strong className="mono-break">{returnedPrivateKey}</strong>
            </div>
          ) : null}
          {returnedMnemonic ? (
            <div className="stat-card mnemonic-card">
              <span className="stat-label">24-Word Mnemonic</span>
              <strong className="mono-break">{returnedMnemonic}</strong>
            </div>
          ) : null}
          {needsBackupConfirmation ? (
            <div className="stat-card backup-confirm-card">
              <label className="backup-confirm-line">
                <input
                  type="checkbox"
                  checked={backupChecked}
                  onChange={(event) => setBackupChecked(event.target.checked)}
                />
                <span>{backupConfirmationLabel}</span>
              </label>
              <button
                type="button"
                onClick={handleConfirmBackup}
                disabled={!backupChecked}
              >
                Confirm Backup
              </button>
            </div>
          ) : null}
          {createdWalletNeedsBackup && backupConfirmed ? (
            <div className="stat-card accent">
              <span className="stat-label">Backup</span>
              <strong>Confirmed</strong>
              <span className="muted">Secrets are hidden after confirmation.</span>
            </div>
          ) : null}
          {derivationPath ? (
            <div className="stat-card">
              <span className="stat-label">Derivation Path</span>
              <strong className="mono-break">{derivationPath}</strong>
            </div>
          ) : null}
          {account ? (
            <div className="stat-card">
              <span className="stat-label">Stored Account</span>
              <strong className="mono-break">{account.ceraAddress}</strong>
              <span className="muted">{account.keyMaterialRef}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
