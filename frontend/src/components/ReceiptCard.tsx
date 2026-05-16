import type { Receipt } from "../types/api";

type ReceiptCardProps = {
  receipt: Receipt | null;
};

export function ReceiptCard({ receipt }: ReceiptCardProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Receipt</h2>
        <span className="muted">The frontend uses block_height and does not depend on block_number.</span>
      </div>
      {!receipt ? (
        <div className="empty-state">No receipt is available yet.</div>
      ) : (
        <div className="grid two-col">
          <div className="stat-card accent">
            <span className="stat-label">Tx Hash</span>
            <code className="mono-break">{receipt.tx_hash}</code>
          </div>
          <div className="stat-card">
            <span className="stat-label">Block Height</span>
            <strong>{receipt.block_height}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Status</span>
            <strong>{receipt.status}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">From</span>
            <code className="mono-break">{receipt.from}</code>
          </div>
          <div className="stat-card">
            <span className="stat-label">To</span>
            <code className="mono-break">{receipt.to}</code>
          </div>
          <div className="stat-card">
            <span className="stat-label">Amount</span>
            <strong>{receipt.amount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Gas Used</span>
            <strong>{receipt.gas_used}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Logs</span>
            <pre>{JSON.stringify(receipt.logs, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
