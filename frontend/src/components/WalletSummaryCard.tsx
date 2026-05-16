import type { WalletSummary } from "../types/api";

type WalletSummaryCardProps = {
  summary: WalletSummary | null;
};

const fields: Array<[keyof WalletSummary, string]> = [
  ["balance", "Balance"],
  ["available", "Available"],
  ["pending_out", "Pending Out"],
  ["pending_in", "Pending In"],
  ["locked_balance", "Locked Balance"],
  ["next_nonce", "Next Nonce"],
  ["block_height", "Block Height"],
  ["account_type", "Account Type"],
  ["account_auth_mode", "Auth Mode"],
  ["account_key_count", "Account Key Count"],
  ["pq_key_count", "PQ Key Count"]
];

export function WalletSummaryCard({ summary }: WalletSummaryCardProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Summary</h2>
        <span className="muted">Use the chain-provided next_nonce as the source of truth.</span>
      </div>
      {!summary ? (
        <div className="empty-state">Summary has not been loaded yet.</div>
      ) : (
        <div className="grid stats-grid">
          <div className="stat-card accent">
            <span className="stat-label">Address</span>
            <code className="mono-break">{summary.address}</code>
          </div>
          {fields.map(([field, label]) => (
            <div key={field} className="stat-card">
              <span className="stat-label">{label}</span>
              <strong>{String(summary[field])}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
