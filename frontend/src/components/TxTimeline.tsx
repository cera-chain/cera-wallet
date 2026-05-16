import type { TxViewState } from "../types/tx-state";

type TxTimelineProps = {
  state: TxViewState | null;
};

type TimelineStep = {
  key: string;
  label: string;
  description: string;
  active: boolean;
  complete: boolean;
};

export function TxTimeline({ state }: TxTimelineProps) {
  const steps: TimelineStep[] = [
    {
      key: "future",
      label: "Future",
      description: "The nonce is ahead of chain state and waits for earlier transactions to fill the gap.",
      active: state?.type === "mempool" && state.status === "future",
      complete: false
    },
    {
      key: "pending",
      label: "Pending",
      description: "The transaction is executable and already sits in the active mempool queue.",
      active: state?.type === "mempool" && state.status === "pending",
      complete:
        (state?.type === "chain" && (state.status === "included" || state.status === "confirmed")) ?? false
    },
    {
      key: "included",
      label: "Included",
      description: "The transaction is in the canonical chain, but a persisted receipt may still not be visible yet.",
      active: state?.type === "chain" && state.status === "included",
      complete: state?.type === "chain" && state.status === "confirmed"
    },
    {
      key: "confirmed",
      label: "Confirmed",
      description: "A receipt exists and the frontend can treat the transaction as confirmed.",
      active: state?.type === "chain" && state.status === "confirmed",
      complete: state?.type === "chain" && state.status === "confirmed"
    }
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Status Timeline</h2>
        <span className="muted">Tracker follows the two-layer progression from mempool state to chain confirmation.</span>
      </div>
      <div className="timeline">
        {steps.map((step) => (
          <article
            key={step.key}
            className={
              step.active
                ? "timeline-step active"
                : step.complete
                  ? "timeline-step complete"
                  : "timeline-step"
            }
          >
            <span className="timeline-dot" />
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
