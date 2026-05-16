import type { ApiError, ForkChoiceStatus } from "../types/api";
import { buildForkChoiceDiagnostic } from "../utils/forkChoiceStatusModel";

type ForkChoiceStatusCardProps = {
  status: ForkChoiceStatus | null;
  error: ApiError | null;
  loading: boolean;
  onRefresh: () => void;
};

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "none";
  }
  return String(value);
}

export function ForkChoiceStatusCard(props: ForkChoiceStatusCardProps) {
  const { status, error, loading, onRefresh } = props;
  const diagnostic = buildForkChoiceDiagnostic(status);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Fork-Choice Status</h2>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh View"}
        </button>
      </div>
      {error ? (
        <div className="field-error">{error.code}: {error.message}</div>
      ) : null}
      {diagnostic ? (
        <div className={`fork-diagnostic fork-diagnostic-${diagnostic.tone}`}>
          <div className="fork-diagnostic-head">
            <span className="stat-label">Diagnostic</span>
            <code className="fork-diagnostic-code">{diagnostic.code}</code>
          </div>
          <h3>{diagnostic.title}</h3>
          <p>{diagnostic.summary}</p>
          <ul className="plain-list">
            {diagnostic.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid stats-grid">
        <div className="stat-card">
          <span className="stat-label">Compatible Advancing Tips</span>
          <strong>{status?.compatible_advancing_tips ?? "-"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Filtered By Finalized Lock</span>
          <strong>{status?.finalized_lock_filtered_tips ?? "-"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Last Result</span>
          <strong>{formatNullable(status?.last_promotion_result_kind)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Reason Code</span>
          <strong>{formatNullable(status?.last_promotion_reason_code)}</strong>
        </div>
      </div>
      <div className="grid two-col">
        <div className="stat-card accent">
          <span className="stat-label">Best Compatible Candidate</span>
          <code className="mono-break">{formatNullable(status?.readiness_best_candidate_hash)}</code>
          <small className="muted">
            Height: {formatNullable(status?.readiness_best_candidate_height)}
          </small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Latest Attempt</span>
          <div className="stack gap-sm">
            <div>
              <strong>Attempts:</strong> {status?.promotion_attempts ?? "-"}
            </div>
            <div>
              <strong>Successes:</strong> {status?.promotion_successes ?? "-"}
            </div>
            <div>
              <strong>Candidate Height:</strong> {formatNullable(status?.last_promotion_candidate_height)}
            </div>
          </div>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-label">Effective Staking Policy Ref</span>
        {status?.effective_staking_policy_ref ? (
          <div className="stack gap-sm">
            <div>
              <strong>Policy Key:</strong> <code>{status.effective_staking_policy_ref.policy_key}</code>
            </div>
            <div>
              <strong>Source:</strong> {status.effective_staking_policy_ref.source}
            </div>
            <div className="muted">
              {status.effective_staking_policy_ref.reward_activation_start}
            </div>
          </div>
        ) : (
          <div className="empty-state">No staking policy reference is currently attached.</div>
        )}
      </div>
    </section>
  );
}
