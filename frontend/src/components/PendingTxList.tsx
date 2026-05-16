import type { PendingTxItem } from "../types/api";

type PendingTxListProps = {
  items: PendingTxItem[];
};

export function PendingTxList({ items }: PendingTxListProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Pending / Future</h2>
        <span className="muted">Sorted by nonce ascending so pending and future do not get mixed up.</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">No visible mempool transactions for this address.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nonce</th>
                <th>Mempool Status</th>
                <th>Hash</th>
                <th>To</th>
                <th>Value</th>
                <th>Fee</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.hash}>
                  <td>{item.nonce}</td>
                  <td>
                    <span className={`pill pill-${item.mempool_status}`}>{item.mempool_status}</span>
                  </td>
                  <td>
                    <code className="mono-break">{item.hash}</code>
                  </td>
                  <td>
                    <code className="mono-break">{item.to}</code>
                  </td>
                  <td>{item.value}</td>
                  <td>{item.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
