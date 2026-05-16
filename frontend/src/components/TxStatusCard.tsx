import { getStateLabel, type TxViewState } from "../types/tx-state";

type TxStatusCardProps = {
  state: TxViewState | null;
  loading: boolean;
  lastUpdatedAt: string | null;
};

export function TxStatusCard({ state, loading, lastUpdatedAt }: TxStatusCardProps) {
  const variant =
    state?.type === "mempool"
      ? state.status
      : state?.type === "chain"
        ? state.status
        : "neutral";

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Status View</h2>
        <span className="muted">Do not treat included as confirmed.</span>
      </div>
      <div className="stack gap-sm">
        <div className={`status-stage status-${variant}`}>
          <span className="status-kicker">Current State</span>
          <strong>{state ? getStateLabel(state) : loading ? "Loading..." : "Waiting For Query"}</strong>
          <small className="muted">
            {lastUpdatedAt ? `Last status refresh: ${lastUpdatedAt}` : "No status refresh yet."}
          </small>
        </div>
        <div className="status-hints">
          <span className="pill pill-future">future = waiting gap fill</span>
          <span className="pill pill-pending">pending = ready in mempool</span>
          <span className="pill pill-included">included = in canonical chain</span>
          <span className="pill pill-confirmed">confirmed = receipt exists</span>
        </div>
      </div>
    </section>
  );
}
