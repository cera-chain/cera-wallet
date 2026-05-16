import type { SendTxResponse } from "../types/api";

export type RecentSendItem = SendTxResponse & {
  createdAt: string;
  label?: string;
};

type RecentSendListProps = {
  items: RecentSendItem[];
  onTrack: (txHash: string) => void;
};

export function RecentSendList({ items, onTrack }: RecentSendListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Recent Sends</h2>
        <span className="muted">Keeps the latest send results so you can jump back into Tracker quickly.</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">No recent send records yet.</div>
      ) : (
        <div className="stack gap-sm">
          {items.map((item) => (
            <article key={`${item.tx_hash}-${item.createdAt}`} className="recent-send">
              <div>
                <code className="mono-break">{item.tx_hash}</code>
                <small className="muted">Submitted at {item.createdAt}</small>
                {item.label ? <small className="muted">Flow: {item.label}</small> : null}
              </div>
              <div className="actions">
                <span className={`pill pill-${item.mempool_status}`}>{item.mempool_status}</span>
                <button type="button" onClick={() => onTrack(item.tx_hash)}>
                  Track
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
