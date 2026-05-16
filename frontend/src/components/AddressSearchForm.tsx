type AddressSearchFormProps = {
  address: string;
  onAddressChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
};

export function AddressSearchForm(props: AddressSearchFormProps) {
  const { address, onAddressChange, onSubmit, loading } = props;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Wallet Dashboard</h2>
        <span className="muted">输入地址后查询链上 summary 与 mempool 视图。</span>
      </div>
      <div className="stack gap-sm">
        <label className="field">
          <span>Wallet Address</span>
          <input
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            placeholder="0x..."
          />
        </label>
        <div className="actions">
          <button type="button" onClick={onSubmit} disabled={loading}>
            {loading ? "Loading..." : "Query Summary"}
          </button>
        </div>
      </div>
    </section>
  );
}
