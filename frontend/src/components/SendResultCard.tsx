import type { SendTxResponse } from "../types/api";

type SendResultCardProps = {
  result: SendTxResponse | null;
  onTrack: (txHash: string) => void;
};

export function SendResultCard({ result, onTrack }: SendResultCardProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Latest Send Result</h2>
        <span className="muted">A successful send only means the node accepted it. It is not confirmed yet.</span>
      </div>
      {!result ? (
        <div className="empty-state">No transaction has been sent yet.</div>
      ) : (
        <div className="stack gap-sm">
          <div className="stat-card accent">
            <span className="stat-label">Tx Hash</span>
            <code className="mono-break">{result.tx_hash}</code>
          </div>
          <div className="stat-card">
            <span className="stat-label">Mempool Status</span>
            <span className={`pill pill-${result.mempool_status}`}>{result.mempool_status}</span>
          </div>
          <div className="actions">
            <button type="button" onClick={() => onTrack(result.tx_hash)}>
              Open Tracker
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
