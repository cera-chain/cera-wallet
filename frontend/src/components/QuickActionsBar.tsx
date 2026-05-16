type QuickActionsBarProps = {
  onUseAddress: () => void;
  onUseNonce: () => void;
  onOpenStaking: () => void;
  hasSummary: boolean;
};

export function QuickActionsBar(props: QuickActionsBarProps) {
  const { onUseAddress, onUseNonce, onOpenStaking, hasSummary } = props;

  return (
    <section className="panel quick-actions">
      <button type="button" onClick={onUseAddress} disabled={!hasSummary}>
        Use Address In Send Form
      </button>
      <button type="button" onClick={onUseNonce} disabled={!hasSummary}>
        Auto Fill Next Nonce
      </button>
      <button type="button" className="secondary" onClick={onOpenStaking} disabled={!hasSummary}>
        Open Staking With This Address
      </button>
    </section>
  );
}
