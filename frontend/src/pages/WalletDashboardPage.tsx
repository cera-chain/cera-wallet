import { AddressSearchForm } from "../components/AddressSearchForm";
import { CheckpointListCard } from "../components/CheckpointListCard";
import { ErrorNotice } from "../components/ErrorNotice";
import { FinalizedCheckpointCard } from "../components/FinalizedCheckpointCard";
import { ForkChoiceStatusCard } from "../components/ForkChoiceStatusCard";
import { HealthStatusCard } from "../components/HealthStatusCard";
import { IntegrationGuideCard } from "../components/IntegrationGuideCard";
import { PendingTxList } from "../components/PendingTxList";
import { QuickActionsBar } from "../components/QuickActionsBar";
import { StakePositionsCard } from "../components/StakePositionsCard";
import { StakingPolicyCard } from "../components/StakingPolicyCard";
import { ValidatorDetailCard } from "../components/ValidatorDetailCard";
import { ValidatorSetCard } from "../components/ValidatorSetCard";
import { WalletSummaryCard } from "../components/WalletSummaryCard";
import { WalletAccountActionsCard } from "../components/WalletAccountActionsCard";
import type {
  ApiError,
  CheckpointsResponse,
  ForkChoiceStatus,
  HealthResponse,
  LatestFinalizedCheckpoint,
  PendingTxItem,
  StakingPolicy,
  StakesResponse,
  ValidatorResponse,
  ValidatorSetResponse,
  WalletSummary
} from "../types/api";

type WalletDashboardPageProps = {
  address: string;
  onAddressChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error: ApiError | null;
  summary: WalletSummary | null;
  pendingItems: PendingTxItem[];
  onUseAddress: () => void;
  onUseNonce: () => void;
  onOpenStaking: (address?: string) => void;
  onWalletAddressSelected: (address: string) => void;
  health: HealthResponse | null;
  healthError: ApiError | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  forkChoiceStatus: ForkChoiceStatus | null;
  forkChoiceError: ApiError | null;
  forkChoiceLoading: boolean;
  onRefreshForkChoice: () => void;
  validatorSet: ValidatorSetResponse | null;
  checkpoints: CheckpointsResponse | null;
  finalized: LatestFinalizedCheckpoint | null;
  stakingPolicy: StakingPolicy | null;
  consensusError: ApiError | null;
  consensusLoading: boolean;
  validator: ValidatorResponse | null;
  stakes: StakesResponse | null;
  addressViewsError: ApiError | null;
  addressViewsLoading: boolean;
  onRefreshConsensus: () => void;
  apiBaseUrl: string;
};

export function WalletDashboardPage(props: WalletDashboardPageProps) {
  const {
    address,
    onAddressChange,
    onRefresh,
    loading,
    error,
    summary,
    pendingItems,
    onUseAddress,
    onUseNonce,
    onOpenStaking,
    onWalletAddressSelected,
    health,
    healthError,
    healthLoading,
    onRefreshHealth,
    forkChoiceStatus,
    forkChoiceError,
    forkChoiceLoading,
    onRefreshForkChoice,
    validatorSet,
    checkpoints,
    finalized,
    stakingPolicy,
    consensusError,
    consensusLoading,
    validator,
    stakes,
    addressViewsError,
    addressViewsLoading,
    onRefreshConsensus,
    apiBaseUrl
  } = props;

  return (
    <div className="page-stack">
      <WalletAccountActionsCard onAddressSelected={onWalletAddressSelected} />
      <HealthStatusCard
        health={health}
        error={healthError}
        loading={healthLoading}
        onRefresh={onRefreshHealth}
        apiBaseUrl={apiBaseUrl}
      />
      <ForkChoiceStatusCard
        status={forkChoiceStatus}
        error={forkChoiceError}
        loading={forkChoiceLoading}
        onRefresh={onRefreshForkChoice}
      />
      <FinalizedCheckpointCard
        finalized={finalized}
        error={consensusError}
        loading={consensusLoading}
        onRefresh={onRefreshConsensus}
      />
      <StakingPolicyCard
        policy={stakingPolicy}
        error={consensusError}
        loading={consensusLoading}
        onRefresh={onRefreshConsensus}
      />
      <IntegrationGuideCard apiBaseUrl={apiBaseUrl} backendOnline={Boolean(health?.ok) && !healthError} />
      <AddressSearchForm
        address={address}
        onAddressChange={onAddressChange}
        onSubmit={onRefresh}
        loading={loading}
      />
      <ErrorNotice error={error} />
      <QuickActionsBar
        onUseAddress={onUseAddress}
        onUseNonce={onUseNonce}
        onOpenStaking={() => onOpenStaking(summary?.address)}
        hasSummary={Boolean(summary)}
      />
      <WalletSummaryCard summary={summary} />
      <ValidatorSetCard
        validatorSet={validatorSet}
        error={consensusError}
        loading={consensusLoading}
      />
      <CheckpointListCard
        checkpoints={checkpoints}
        error={consensusError}
        loading={consensusLoading}
      />
      <ValidatorDetailCard
        address={address}
        validator={validator}
        error={addressViewsError}
        loading={addressViewsLoading}
        onOpenStaking={onOpenStaking}
      />
      <StakePositionsCard
        address={address}
        stakes={stakes}
        checkpoints={checkpoints}
        error={addressViewsError}
        loading={addressViewsLoading}
        onOpenStaking={onOpenStaking}
      />
      <PendingTxList items={pendingItems} />
    </div>
  );
}
