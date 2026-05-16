import { useState } from "react";
import { ErrorNotice } from "../components/ErrorNotice";
import { NonceHelperCard } from "../components/NonceHelperCard";
import { RecentSendList, type RecentSendItem } from "../components/RecentSendList";
import { SendResultCard } from "../components/SendResultCard";
import { StakingActionContextCard } from "../components/StakingActionContextCard";
import { StakingFollowUpGuideCard } from "../components/StakingFollowUpGuideCard";
import { StakingConsoleCard } from "../components/StakingConsoleCard";
import { SendTxForm } from "../components/SendTxForm";
import type { SendTxPayload } from "../services/tx";
import type {
  ApiError,
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  SendTxResponse,
  StakingAction,
  StakesResponse,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

type SendTransactionPageProps = {
  fromAddress: string;
  suggestedNonce: number | null;
  sendModeLabel?: string | null;
  onSubmit: (payload: SendTxPayload) => Promise<void>;
  sending: boolean;
  error: ApiError | null;
  result: SendTxResponse | null;
  recentSends: RecentSendItem[];
  onTrack: (txHash: string) => void;
  onStakingSuccess?: (result: SendTxResponse, meta: { action: StakingAction; from?: string }) => void;
  stakingSummary: WalletSummary | null;
  stakingValidator: ValidatorResponse | null;
  stakingStakes: StakesResponse | null;
  stakingCheckpoints: CheckpointsResponse | null;
  stakingFinalized: LatestFinalizedCheckpoint | null;
  stakingLoading: boolean;
  stakingError: ApiError | null;
  latestStakingAction: {
    action: StakingAction;
    from?: string;
    result: SendTxResponse;
    createdAt: string;
  } | null;
};

export function SendTransactionPage(props: SendTransactionPageProps) {
  const [activeStakingAction, setActiveStakingAction] = useState<StakingAction>("validator_register");
  const {
    fromAddress,
    suggestedNonce,
    sendModeLabel,
    onSubmit,
    sending,
    error,
    result,
    recentSends,
    onTrack,
    onStakingSuccess,
    stakingSummary,
    stakingValidator,
    stakingStakes,
    stakingCheckpoints,
    stakingFinalized,
    stakingLoading,
    stakingError,
    latestStakingAction
  } =
    props;

  return (
    <div className="page-stack">
      {sendModeLabel ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Current Send Context</h2>
            <span className="muted">Cross-page handoff</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-label">Working Mode</span>
            <strong>{sendModeLabel}</strong>
            <span className="muted">
              The send page was opened from dashboard context and is preloaded with the selected address flow.
            </span>
          </div>
        </section>
      ) : null}
      <NonceHelperCard suggestedNonce={suggestedNonce} fromAddress={fromAddress} />
      <ErrorNotice error={error} />
      <SendTxForm
        initialFrom={fromAddress}
        suggestedNonce={suggestedNonce}
        onSubmit={onSubmit}
        sending={sending}
        error={null}
      />
      <SendResultCard result={result} onTrack={onTrack} />
      <StakingFollowUpGuideCard
        latestAction={latestStakingAction}
        summary={stakingSummary}
        validator={stakingValidator}
        stakes={stakingStakes}
        checkpoints={stakingCheckpoints}
        finalized={stakingFinalized}
        loading={stakingLoading}
        onTrack={onTrack}
      />
      <StakingActionContextCard
        address={fromAddress}
        summary={stakingSummary}
        validator={stakingValidator}
        stakes={stakingStakes}
        checkpoints={stakingCheckpoints}
        finalized={stakingFinalized}
        focusAction={activeStakingAction}
        loading={stakingLoading}
        error={stakingError}
      />
      <StakingConsoleCard
        initialFrom={fromAddress}
        suggestedNonce={suggestedNonce}
        currentSummary={stakingSummary}
        currentValidator={stakingValidator}
        currentStakes={stakingStakes}
        currentCheckpoints={stakingCheckpoints}
        currentFinalized={stakingFinalized}
        onTrack={onTrack}
        onActionChange={setActiveStakingAction}
        onSuccess={onStakingSuccess}
      />
      <RecentSendList items={recentSends} onTrack={onTrack} />
    </div>
  );
}
