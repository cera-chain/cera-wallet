import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SendTransactionPage } from "./SendTransactionPage";
import { TransactionTrackerPage } from "./TransactionTrackerPage";
import { WalletDashboardPage } from "./WalletDashboardPage";
import type {
  CheckpointsResponse,
  ForkChoiceStatus,
  HealthResponse,
  LatestFinalizedCheckpoint,
  StakesResponse,
  StakingPolicy,
  ValidatorResponse,
  ValidatorSetResponse,
  WalletSummary
} from "../types/api";

const noop = () => {};

const summary: WalletSummary = {
  address: "0x1234567890abcdef",
  balance: "1000",
  available: "992",
  pending_out: "7",
  pending_in: "0",
  locked_balance: "1",
  next_nonce: 4,
  block_height: 12,
  account_auth_mode: "single",
  account_type: "user",
  account_key_count: 1,
  pq_key_count: 0
};

const health: HealthResponse = { ok: true, service: "cera-wallet" };

const forkChoiceStatus: ForkChoiceStatus = {
  scope: "fork_choice",
  tip_height: 12,
  side_branch_tips: 0,
  best_side_branch_tip_hash: null,
  best_side_branch_tip_height: null,
  best_side_branch_tip_state_root: null,
  advancing_side_branch_tips: 0,
  compatible_advancing_tips: 0,
  finalized_lock_filtered_tips: 0,
  readiness_best_candidate_hash: null,
  readiness_best_candidate_height: null,
  promotion_attempts: 0,
  promotion_successes: 0,
  last_promotion_outcome: null,
  last_promotion_result_kind: null,
  last_promotion_reason_code: null,
  last_promotion_candidate_hash: null,
  last_promotion_candidate_height: null,
  effective_staking_policy_ref: null
};

const validatorSet: ValidatorSetResponse = { validator_set: [], count: 0 };
const checkpoints: CheckpointsResponse = { checkpoints: [], count: 0, latest_checkpoint_height: null };
const finalized: LatestFinalizedCheckpoint = { found: false };
const stakingPolicy: StakingPolicy = {
  token_symbol: "CERA",
  token_decimals: 18,
  mainnet_chain_id: "cera-dev",
  min_unbonding_checkpoint_delay: 2,
  reward_per_progress_height_display_units: 1,
  reward_stake_unit_display_units: 1,
  reward_min_progress_heights: 1,
  reward_requires_active_validator_set: true,
  reward_activation_start: "0"
};
const validator: ValidatorResponse = { found: false };
const stakes: StakesResponse = {
  stakes: [],
  count: 0,
  validator_address: null,
  staker_address: null,
  latest_progress_height: 0
};

describe("page smoke tests", () => {
  it("renders the dashboard with summary and pending sections", () => {
    const html = renderToStaticMarkup(
      <WalletDashboardPage
        address={summary.address}
        onAddressChange={noop}
        onRefresh={noop}
        loading={false}
        error={null}
        summary={summary}
        pendingItems={[]}
        onUseAddress={noop}
        onUseNonce={noop}
        onOpenStaking={noop}
        onWalletAddressSelected={noop}
        health={health}
        healthError={null}
        healthLoading={false}
        onRefreshHealth={noop}
        forkChoiceStatus={forkChoiceStatus}
        forkChoiceError={null}
        forkChoiceLoading={false}
        onRefreshForkChoice={noop}
        validatorSet={validatorSet}
        checkpoints={checkpoints}
        finalized={finalized}
        stakingPolicy={stakingPolicy}
        consensusError={null}
        consensusLoading={false}
        validator={validator}
        stakes={stakes}
        addressViewsError={null}
        addressViewsLoading={false}
        onRefreshConsensus={noop}
        apiBaseUrl="http://127.0.0.1:3000"
      />
    );

    expect(html).toContain("Integration Guide");
    expect(html).toContain("Summary");
    expect(html).toContain("Pending / Future");
    expect(html).toContain("0x1234567890abcdef");
  });

  it("renders the send page with transfer and staking entry points", () => {
    const html = renderToStaticMarkup(
      <SendTransactionPage
        fromAddress={summary.address}
        suggestedNonce={summary.next_nonce}
        sendModeLabel="Staking flow from dashboard context"
        onSubmit={vi.fn(async () => undefined)}
        sending={false}
        error={null}
        result={{ tx_hash: "0xabc", mempool_status: "pending" }}
        recentSends={[{ tx_hash: "0xabc", mempool_status: "pending", createdAt: "10:00:00", label: "transfer" }]}
        stakingSummary={summary}
        stakingValidator={validator}
        stakingStakes={stakes}
        stakingCheckpoints={checkpoints}
        stakingFinalized={finalized}
        stakingLoading={false}
        stakingError={null}
        latestStakingAction={{
          action: "stake_bond",
          from: summary.address,
          result: { tx_hash: "0xstake", mempool_status: "pending" },
          createdAt: "10:01:00"
        }}
        onTrack={noop}
      />
    );

    expect(html).toContain("Nonce Helper");
    expect(html).toContain("Current Send Context");
    expect(html).toContain("Send Transaction");
    expect(html).toContain("Latest Send Result");
    expect(html).toContain("Staking Follow-Up Guide");
    expect(html).toContain("Refresh Targets");
    expect(html).toContain("Staking Action Context");
    expect(html).toContain("Action Signals");
    expect(html).toContain("Risk Signals");
    expect(html).toContain("Staking Console");
    expect(html).toContain("Recent Sends");
  });

  it("renders the tracker page with status, timeline, and receipt", () => {
    const html = renderToStaticMarkup(
      <TransactionTrackerPage
        txHash="0xabc"
        onTxHashChange={noop}
        onRefresh={noop}
        loading={false}
        error={null}
        state={{ type: "chain", status: "confirmed" }}
        receipt={{
          tx_hash: "0xabc",
          block_height: 1,
          status: "success",
          from: summary.address,
          to: "0xabcdef1234567890",
          amount: 7,
          gas_used: 1,
          logs: []
        }}
        pollingEnabled={false}
        onTogglePolling={noop}
        lastUpdatedAt="10:00:00"
      />
    );

    expect(html).toContain("Status View");
    expect(html).toContain("Status Timeline");
    expect(html).toContain("Receipt");
    expect(html).toContain("Chain / Confirmed");
    expect(html).toContain("Block Height");
  });
});
