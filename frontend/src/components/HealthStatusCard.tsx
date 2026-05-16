import type { ApiError, HealthResponse } from "../types/api";

type HealthStatusCardProps = {
  health: HealthResponse | null;
  error: ApiError | null;
  loading: boolean;
  onRefresh: () => void;
  apiBaseUrl: string;
};

export function HealthStatusCard(props: HealthStatusCardProps) {
  const { health, error, loading, onRefresh, apiBaseUrl } = props;
  const statusClass = error ? "health-offline" : health?.ok ? "health-online" : "health-idle";
  const label = error ? "API Offline" : health?.ok ? "API Online" : "API Unknown";

  return (
    <section className={`panel health-card ${statusClass}`}>
      <div className="panel-header">
        <h2>Backend Health</h2>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Checking..." : "Refresh Health"}
        </button>
      </div>
      <div className="stack gap-sm">
        <div className="health-line">
          <span className="stat-label">API Base</span>
          <code>{apiBaseUrl}</code>
        </div>
        <div className="health-line">
          <span className="stat-label">Status</span>
          <strong>{label}</strong>
        </div>
        <div className="health-line">
          <span className="stat-label">Service</span>
          <strong>{health?.service ?? "-"}</strong>
        </div>
        {error ? <small className="field-error">{error.code}: {error.message}</small> : null}
      </div>
    </section>
  );
}
