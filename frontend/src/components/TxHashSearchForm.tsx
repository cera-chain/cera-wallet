type TxHashSearchFormProps = {
  txHash: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function TxHashSearchForm({ txHash, onChange, onSubmit, loading }: TxHashSearchFormProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Transaction Tracker</h2>
        <span className="muted">Query transaction status, watch progression, and inspect the final receipt.</span>
      </div>
      <div className="stack gap-sm">
        <label className="field">
          <span>Tx Hash</span>
          <input
            value={txHash}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0x..."
            autoComplete="off"
          />
        </label>
        <div className="actions">
          <button type="button" onClick={onSubmit} disabled={loading || !txHash.trim()}>
            {loading ? "Refreshing..." : "Query Status"}
          </button>
        </div>
      </div>
    </section>
  );
}
