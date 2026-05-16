type IntegrationGuideCardProps = {
  apiBaseUrl: string;
  backendOnline: boolean;
};

const steps = [
  "1. Confirm Backend Health is Online before testing any wallet flow.",
  "2. Query a real address in Dashboard and verify summary plus next_nonce first.",
  "3. After send, check mempool_status first. Send success is not confirmation.",
  "4. Use Tracker to watch pending / future / included / confirmed progression.",
  "5. Only treat the transaction as confirmed when a receipt with block_height is visible."
];

const rules = [
  "Nonce must come from chain next_nonce.",
  "mempool_status must distinguish pending and future.",
  "included must not be treated as confirmed.",
  "Receipt handling must rely on block_height."
];

export function IntegrationGuideCard({ apiBaseUrl, backendOnline }: IntegrationGuideCardProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Integration Guide</h2>
        <span className="muted">Recommended order for frontend, wallet, and integration checks.</span>
      </div>
      <div className="grid two-col">
        <div className="stat-card accent">
          <span className="stat-label">Current API Base</span>
          <code>{apiBaseUrl}</code>
          <small className="muted">
            {backendOnline ? "Backend reachable. You can start querying summary." : "Backend offline. Fix health first."}
          </small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Stable Rules</span>
          <ul className="plain-list">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="checklist">
        {steps.map((step) => (
          <div key={step} className="checklist-item">
            {step}
          </div>
        ))}
      </div>
    </section>
  );
}
