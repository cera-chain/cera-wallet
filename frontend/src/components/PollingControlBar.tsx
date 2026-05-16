type PollingControlBarProps = {
  pollingEnabled: boolean;
  onToggle: (value: boolean) => void;
  onRefresh: () => void;
  lastUpdatedAt: string | null;
};

export function PollingControlBar(props: PollingControlBarProps) {
  const { pollingEnabled, onToggle, onRefresh, lastUpdatedAt } = props;

  return (
    <section className="panel quick-actions">
      <button type="button" onClick={onRefresh}>
        Refresh Now
      </button>
      <button type="button" className="secondary" onClick={() => onToggle(!pollingEnabled)}>
        {pollingEnabled ? "Pause Polling" : "Resume Polling"}
      </button>
      <span className="muted">
        {pollingEnabled ? "Auto refresh is on." : "Auto refresh is paused."} Last Updated: {lastUpdatedAt ?? "-"}
      </span>
    </section>
  );
}
