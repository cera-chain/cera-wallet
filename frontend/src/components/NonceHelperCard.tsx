type NonceHelperCardProps = {
  suggestedNonce: number | null;
  fromAddress: string;
};

export function NonceHelperCard({ suggestedNonce, fromAddress }: NonceHelperCardProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Nonce Helper</h2>
        <span className="muted">Always use chain summary next_nonce. Do not infer it locally with +1.</span>
      </div>
      <div className="grid two-col">
        <div className="stat-card">
          <span className="stat-label">Suggested Nonce</span>
          <strong>{suggestedNonce ?? "-"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Current From Address</span>
          <code className="mono-break">{fromAddress || "-"}</code>
        </div>
      </div>
    </section>
  );
}
