import { useEffect, useState } from "react";
import { subscribeDebugLog, type DebugLogEntry } from "../services/http";
import { getApiBaseUrl } from "../services/wallet";
import type { ApiError, ForkChoiceStatus } from "../types/api";

type DebugPanelProps = {
  forkChoiceStatus: ForkChoiceStatus | null;
  forkChoiceError: ApiError | null;
  forkChoiceLoading: boolean;
};

export function DebugPanel(props: DebugPanelProps) {
  const [entries, setEntries] = useState<DebugLogEntry[]>([]);
  const { forkChoiceStatus, forkChoiceError, forkChoiceLoading } = props;

  useEffect(() => {
    const unsubscribe = subscribeDebugLog((entry) => {
      setEntries((current) => [entry, ...current].slice(0, 8));
    });
    return unsubscribe;
  }, []);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <section className="panel debug-panel">
      <div className="panel-header">
        <h2>Debug Panel</h2>
        <span className="muted">开发态原始请求/响应，帮助联调协议。</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">API Base URL</span>
        <code>{getApiBaseUrl()}</code>
      </div>
      <div className="stat-card">
        <span className="stat-label">Fork Choice View</span>
        {forkChoiceLoading && !forkChoiceStatus ? (
          <span className="muted">Loading fork-choice snapshot...</span>
        ) : forkChoiceError ? (
          <span className="field-error">
            {forkChoiceError.code}: {forkChoiceError.message}
          </span>
        ) : forkChoiceStatus ? (
          <div className="debug-summary-grid">
            <div>
              <strong>compatible_advancing_tips</strong>
              <div>{forkChoiceStatus.compatible_advancing_tips}</div>
            </div>
            <div>
              <strong>last_result</strong>
              <div>{forkChoiceStatus.last_promotion_result_kind ?? "none"}</div>
            </div>
            <div>
              <strong>reason_code</strong>
              <div>{forkChoiceStatus.last_promotion_reason_code ?? "none"}</div>
            </div>
            <div>
              <strong>best_candidate</strong>
              <div className="mono-break">
                {forkChoiceStatus.readiness_best_candidate_hash ?? "none"}
              </div>
            </div>
            <div>
              <strong>policy_ref</strong>
              <div>{forkChoiceStatus.effective_staking_policy_ref?.policy_key ?? "none"}</div>
            </div>
          </div>
        ) : (
          <div className="empty-state">暂无 fork-choice 状态快照。</div>
        )}
      </div>
      {forkChoiceStatus ? (
        <article className="debug-entry">
          <div className="debug-meta">
            <strong>fork-choice.snapshot</strong>
            <span>response</span>
            <span>live</span>
          </div>
          <pre>{JSON.stringify(forkChoiceStatus, null, 2)}</pre>
        </article>
      ) : null}
      <div className="stack gap-sm">
        {entries.length === 0 ? (
          <div className="empty-state">暂无调试日志。</div>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="debug-entry">
              <div className="debug-meta">
                <strong>{entry.label}</strong>
                <span>{entry.kind}</span>
                <span>{entry.timestamp}</span>
              </div>
              <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
