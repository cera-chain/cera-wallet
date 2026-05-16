import { useEffect, useState, type FormEvent } from "react";
import type { ApiError } from "../types/api";
import type { SendTxPayload } from "../services/tx";
import type { ValidationErrors } from "../utils/validation";
import { validateSendTxPayload } from "../utils/validation";

type SendTxFormProps = {
  initialFrom?: string;
  suggestedNonce?: number | null;
  onSubmit: (payload: SendTxPayload) => Promise<void>;
  sending: boolean;
  error: ApiError | null;
};

type FormState = {
  from: string;
  to: string;
  amount: string;
  fee: string;
  privateKey: string;
  nonce: string;
};

export function SendTxForm(props: SendTxFormProps) {
  const { initialFrom = "", suggestedNonce, onSubmit, sending, error } = props;
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [form, setForm] = useState<FormState>({
    from: initialFrom,
    to: "",
    amount: "",
    fee: "1",
    privateKey: "",
    nonce: suggestedNonce == null ? "" : String(suggestedNonce)
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      from: initialFrom,
      nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
    }));
  }, [initialFrom, suggestedNonce]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: SendTxPayload = {
      from: form.from.trim() || undefined,
      to: form.to.trim(),
      amount: form.amount.trim(),
      fee: form.fee.trim() || undefined,
      privateKey: form.privateKey.trim(),
      nonce: form.nonce.trim() ? Number(form.nonce.trim()) : undefined
    };
    const nextValidationErrors = validateSendTxPayload(payload);

    if (Object.keys(nextValidationErrors).length > 0) {
      setValidationErrors(nextValidationErrors);
      return;
    }

    await onSubmit(payload);

    setForm((current) => ({
      ...current,
      to: "",
      amount: "",
      privateKey: "",
      nonce: suggestedNonce == null ? "" : String(suggestedNonce)
    }));
    setValidationErrors({});
  }

  function handleAutoFillNonce() {
    if (suggestedNonce != null) {
      update("nonce", String(suggestedNonce));
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Send Transaction</h2>
        <span className="muted">
          Local validation is only a convenience check. Final acceptance always depends on chain response.
        </span>
      </div>
      <form className="stack gap-md" onSubmit={handleSubmit}>
        <div className="grid two-col">
          <label className="field">
            <span>From (Optional)</span>
            <input
              value={form.from}
              onChange={(event) => update("from", event.target.value)}
              placeholder="Defaults to the signer-derived address"
              autoComplete="off"
            />
            {validationErrors.from ? <small className="field-error">{validationErrors.from}</small> : null}
          </label>
          <label className="field">
            <span>To</span>
            <input
              value={form.to}
              onChange={(event) => update("to", event.target.value)}
              placeholder="0x..."
              autoComplete="off"
              required
            />
            {validationErrors.to ? <small className="field-error">{validationErrors.to}</small> : null}
          </label>
          <label className="field">
            <span>Amount</span>
            <input
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="7"
              required
            />
            {validationErrors.amount ? <small className="field-error">{validationErrors.amount}</small> : null}
          </label>
          <label className="field">
            <span>Fee</span>
            <input
              inputMode="decimal"
              value={form.fee}
              onChange={(event) => update("fee", event.target.value)}
              placeholder="1"
            />
            {validationErrors.fee ? <small className="field-error">{validationErrors.fee}</small> : null}
          </label>
          <label className="field">
            <span>Private Key</span>
            <textarea
              rows={4}
              value={form.privateKey}
              onChange={(event) => update("privateKey", event.target.value)}
              placeholder="Paste the sender private key only for this request"
              autoComplete="off"
              required
            />
            {validationErrors.privateKey ? (
              <small className="field-error">{validationErrors.privateKey}</small>
            ) : null}
            {!validationErrors.privateKey ? (
              <small className="muted">The private key signs locally in this browser; only the signed transaction is submitted.</small>
            ) : null}
          </label>
          <label className="field">
            <span>Nonce (Optional)</span>
            <input
              inputMode="numeric"
              value={form.nonce}
              onChange={(event) => update("nonce", event.target.value)}
              placeholder={suggestedNonce == null ? "Leave empty to let the wallet choose" : `Suggested: ${suggestedNonce}`}
            />
            {validationErrors.nonce ? <small className="field-error">{validationErrors.nonce}</small> : null}
            {!validationErrors.nonce && suggestedNonce != null ? (
              <small className="muted">Recommended source of truth: chain summary next_nonce = {suggestedNonce}.</small>
            ) : null}
          </label>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={handleAutoFillNonce} disabled={suggestedNonce == null}>
            Auto Fill Next Nonce
          </button>
          <button type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send Transaction"}
          </button>
        </div>
        {error ? <div className="error-banner">{error.code}: {error.message}</div> : null}
      </form>
    </section>
  );
}
