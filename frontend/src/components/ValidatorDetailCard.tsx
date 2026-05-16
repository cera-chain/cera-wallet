import type { ApiError, ValidatorResponse } from "../types/api";

type ValidatorDetailCardProps = {
  address: string;
  validator: ValidatorResponse | null;
  error: ApiError | null;
  loading: boolean;
  onOpenStaking?: (address: string) => void;
};

export function ValidatorDetailCard(props: ValidatorDetailCardProps) {
  const { address, validator, error, loading, onOpenStaking } = props;
  const normalizedAddress = address.trim();

  const statusHint =
    validator && validator.found
      ? validator.validator.status === "pending"
        ? "Pending validators stay out of the active validator set until they self-bond."
        : validator.validator.status === "inactive"
          ? "Inactive validators can return only through self-bond or self-rebond. Delegation does not reactivate them."
          : validator.validator_set_entry
            ? `Active in validator set since checkpoint ${validator.validator_set_entry.active_from_height}.`
            : "Active validator record is present, but it is not currently in the active validator set."
      : null;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Validator Detail</h2>
        <span className="muted">{loading ? "Refreshing..." : "Address Scoped"}</span>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!normalizedAddress ? (
        <div className="empty-state">Enter an address to inspect whether it is a registered validator.</div>
      ) : !validator ? (
        <div className="empty-state">Validator detail has not loaded yet.</div>
      ) : !validator.found ? (
        <div className="empty-state">
          <code className="mono-break">{normalizedAddress}</code> is not currently registered as a validator.
        </div>
      ) : (
        <>
          <div className="grid stats-grid">
            <article className="stat-card">
              <span className="stat-label">Validator Address</span>
              <code className="mono-break">{validator.validator.validator_address}</code>
            </article>
            <article className="stat-card">
              <span className="stat-label">Status</span>
              <strong>{validator.validator.status}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Stake Count</span>
              <strong>{validator.stake_count}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Bonded Total</span>
              <strong>{validator.bonded_total_base_units}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Voting Power</span>
              <strong>{String(validator.validator_set_entry?.voting_power ?? 0)}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Active From</span>
              <strong>{validator.validator_set_entry?.active_from_height ?? "not active"}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Metadata Version</span>
              <strong>{validator.validator.metadata_version}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Consensus Key</span>
              <code className="mono-break">{validator.validator.consensus_public_key}</code>
            </article>
          </div>
          {statusHint ? <p className="muted">{statusHint}</p> : null}
          {onOpenStaking ? (
            <div className="actions">
              <button type="button" className="secondary" onClick={() => onOpenStaking(validator.validator.validator_address)}>
                Open Staking For This Validator
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
