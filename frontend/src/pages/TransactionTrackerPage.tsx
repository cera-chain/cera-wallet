import { ErrorNotice } from "../components/ErrorNotice";
import { PollingControlBar } from "../components/PollingControlBar";
import { ReceiptCard } from "../components/ReceiptCard";
import { TxHashSearchForm } from "../components/TxHashSearchForm";
import { TxStatusCard } from "../components/TxStatusCard";
import { TxTimeline } from "../components/TxTimeline";
import type { ApiError, Receipt } from "../types/api";
import type { TxViewState } from "../types/tx-state";

type TransactionTrackerPageProps = {
  txHash: string;
  onTxHashChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error: ApiError | null;
  state: TxViewState | null;
  receipt: Receipt | null;
  pollingEnabled: boolean;
  onTogglePolling: (value: boolean) => void;
  lastUpdatedAt: string | null;
};

export function TransactionTrackerPage(props: TransactionTrackerPageProps) {
  const {
    txHash,
    onTxHashChange,
    onRefresh,
    loading,
    error,
    state,
    receipt,
    pollingEnabled,
    onTogglePolling,
    lastUpdatedAt
  } = props;

  return (
    <div className="page-stack">
      <TxHashSearchForm txHash={txHash} onChange={onTxHashChange} onSubmit={onRefresh} loading={loading} />
      <ErrorNotice error={error} />
      <PollingControlBar
        pollingEnabled={pollingEnabled}
        onToggle={onTogglePolling}
        onRefresh={onRefresh}
        lastUpdatedAt={lastUpdatedAt}
      />
      <TxStatusCard state={state} loading={loading} lastUpdatedAt={lastUpdatedAt} />
      <TxTimeline state={state} />
      <ReceiptCard receipt={receipt} />
    </div>
  );
}
