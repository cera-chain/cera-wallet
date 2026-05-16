import type { ApiError, CheckpointsResponse } from "../types/api";

type CheckpointListCardProps = {
  checkpoints: CheckpointsResponse | null;
  error: ApiError | null;
  loading: boolean;
};

export function CheckpointListCard(props: CheckpointListCardProps) {
  const { checkpoints, error, loading } = props;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Checkpoints</h2>
        <span className="muted">
          {loading
            ? "Refreshing..."
            : `Latest Height: ${checkpoints?.latest_checkpoint_height ?? "none"}`}
        </span>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!checkpoints || checkpoints.checkpoints.length === 0 ? (
        <div className="empty-state">No checkpoint records are currently available.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Height</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Block Hash</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.checkpoints.map((checkpoint) => (
                <tr key={`${checkpoint.checkpoint_height}-${checkpoint.block_hash}`}>
                  <td>{checkpoint.checkpoint_height}</td>
                  <td>{checkpoint.status}</td>
                  <td>{checkpoint.created_at_height}</td>
                  <td><code className="mono-break">{checkpoint.block_hash}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
