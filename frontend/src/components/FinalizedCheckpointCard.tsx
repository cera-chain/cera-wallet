import type { ApiError, LatestFinalizedCheckpoint } from "../types/api";

type FinalizedCheckpointCardProps = {
  finalized: LatestFinalizedCheckpoint | null;
  error: ApiError | null;
  loading: boolean;
  onRefresh: () => void;
};

export function FinalizedCheckpointCard(props: FinalizedCheckpointCardProps) {
  const { finalized, error, loading, onRefresh } = props;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Latest Finalized Checkpoint</h2>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!finalized || !finalized.found ? (
        <div className="empty-state">No finalized checkpoint is currently available.</div>
      ) : (
        <div className="grid stats-grid">
          <div className="stat-card">
            <span className="stat-label">Checkpoint Height</span>
            <strong>{finalized.checkpoint_height}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Status</span>
            <strong>{finalized.status}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Created At Height</span>
            <strong>{finalized.created_at_height}</strong>
          </div>
          <div className="stat-card accent">
            <span className="stat-label">Block Hash</span>
            <code className="mono-break">{finalized.block_hash}</code>
          </div>
        </div>
      )}
    </section>
  );
}
