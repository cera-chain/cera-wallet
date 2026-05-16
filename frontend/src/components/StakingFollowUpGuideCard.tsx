import type {
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  SendTxResponse,
  StakesResponse,
  StakingAction,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

type StakingFollowUpGuideCardProps = {
  latestAction: {
    action: StakingAction;
    from?: string;
    result: SendTxResponse;
    createdAt: string;
  } | null;
  summary: WalletSummary | null;
  validator: ValidatorResponse | null;
  stakes: StakesResponse | null;
  checkpoints: CheckpointsResponse | null;
  finalized: LatestFinalizedCheckpoint | null;
  loading: boolean;
  onTrack: (txHash: string) => void;
};

function getGuide(action: StakingAction) {
  switch (action) {
    case "validator_register":
      return {
        title: "Validator registration submitted",
        checkpoints: [
          "Track the transaction until it is confirmed.",
          "Then refresh Validator Detail and look for a pending validator record.",
          "If the validator is pending, the next operational step is a positive self-bond."
        ]
      };
    case "stake_bond":
      return {
        title: "Bond transaction submitted",
        checkpoints: [
          "Track the transaction until it is confirmed.",
          "Then refresh Stake Positions to verify the bonded or restored position.",
          "If this was self-bond, also check Validator Detail for pending-to-active or inactive-to-active movement."
        ]
      };
    case "stake_unbond":
      return {
        title: "Unbond transaction submitted",
        checkpoints: [
          "Track the transaction until it is confirmed.",
          "Then refresh Stake Positions and confirm the position moved into unbonding.",
          "After finalized progress advances far enough, return and use Unbond Finalize."
        ]
      };
    case "stake_unbond_finalize":
      return {
        title: "Unbond finalize submitted",
        checkpoints: [
          "Track the transaction until it is confirmed.",
          "Then refresh Stake Positions and confirm the unbonding position disappeared or settled.",
          "Finally refresh Wallet Summary and verify the liquid balance returned."
        ]
      };
    case "stake_reward_claim":
      return {
        title: "Reward claim submitted",
        checkpoints: [
          "Track the transaction until it is confirmed.",
          "Then refresh Wallet Summary and Stake Positions to verify reward movement.",
          "If the expected reward is still missing, inspect reward cursor progress and validator status."
        ]
      };
  }
}

function getRefreshTargets(
  action: StakingAction,
  summary: WalletSummary | null,
  validator: ValidatorResponse | null,
  stakes: StakesResponse | null,
  checkpoints: CheckpointsResponse | null,
  finalized: LatestFinalizedCheckpoint | null
) {
  const bondedCount = stakes?.stakes.filter((stake) => stake.status === "bonded").length ?? 0;
  const unbondingCount = stakes?.stakes.filter((stake) => stake.status === "unbonding").length ?? 0;
  const readyToFinalizeCount =
    stakes?.stakes.filter(
      (stake) =>
        stake.status === "unbonding" &&
        checkpoints?.latest_checkpoint_height != null &&
        stake.unlock_requested_height != null &&
        checkpoints.latest_checkpoint_height >= stake.unlock_requested_height + 1
    ).length ?? 0;
  const validatorStatus = validator?.found ? validator.validator.status : "not registered";
  const latestFinalizedCheckpoint = finalized?.found ? finalized.checkpoint_height : checkpoints?.latest_checkpoint_height ?? "none";

  switch (action) {
    case "validator_register":
      return [
        { label: "Validator Status", value: validatorStatus, expectation: "Should move toward a visible pending validator record." },
        { label: "Suggested Next Nonce", value: summary?.next_nonce ?? "-", expectation: "Usually increments after the confirmed submit." }
      ];
    case "stake_bond":
      return [
        { label: "Bonded Positions", value: bondedCount, expectation: "Should reflect the new or restored bonded position after confirmation." },
        { label: "Validator Status", value: validatorStatus, expectation: "If this was self-bond, pending/inactive can move toward active." },
        { label: "Available Balance", value: summary?.available ?? "-", expectation: "Should decrease if fresh stake moved out of liquid balance." }
      ];
    case "stake_unbond":
      return [
        { label: "Unbonding Positions", value: unbondingCount, expectation: "Should increase once the bonded position enters unbonding." },
        { label: "Ready To Finalize", value: readyToFinalizeCount, expectation: "Watch this after finalized progress advances." },
        { label: "Latest Finalized Checkpoint", value: latestFinalizedCheckpoint, expectation: "Needs to move forward before finalize becomes available." }
      ];
    case "stake_unbond_finalize":
      return [
        { label: "Unbonding Positions", value: unbondingCount, expectation: "Should drop after the mature unbonding position settles." },
        { label: "Available Balance", value: summary?.available ?? "-", expectation: "Should recover when liquid balance returns." },
        { label: "Ready To Finalize", value: readyToFinalizeCount, expectation: "Should fall once the mature position is finalized." }
      ];
    case "stake_reward_claim":
      return [
        { label: "Available Balance", value: summary?.available ?? "-", expectation: "May increase if the reward is realized into liquid balance." },
        { label: "Bonded Positions", value: bondedCount, expectation: "Use this alongside reward visibility to confirm the claim did not disturb stake shape." },
        { label: "Latest Finalized Checkpoint", value: latestFinalizedCheckpoint, expectation: "If reward is missing, check whether finalized progress is still gating it." }
      ];
  }
}

export function StakingFollowUpGuideCard({
  latestAction,
  summary,
  validator,
  stakes,
  checkpoints,
  finalized,
  loading,
  onTrack
}: StakingFollowUpGuideCardProps) {
  if (!latestAction) {
    return null;
  }

  const guide = getGuide(latestAction.action);
  const refreshTargets = getRefreshTargets(latestAction.action, summary, validator, stakes, checkpoints, finalized);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Staking Follow-Up Guide</h2>
        <span className="muted">Latest staking flow from {latestAction.createdAt}</span>
      </div>
      <div className="stack gap-md">
        <div className="stat-card accent">
          <span className="stat-label">Latest Action</span>
          <strong>{guide.title}</strong>
          <span className="muted">
            Action: {latestAction.action}
            {latestAction.from ? ` | From: ${latestAction.from}` : ""}
          </span>
        </div>
        <div className="staking-checks">
          {guide.checkpoints.map((item) => (
            <div key={item} className="staking-check-item">
              {item}
            </div>
          ))}
        </div>
        <div className="stack gap-sm">
          <div className="panel-header">
            <h2>Refresh Targets</h2>
            <span className="muted">{loading ? "Refreshing latest snapshot..." : "Watch these fields on this page"}</span>
          </div>
          <div className="grid stats-grid">
            {refreshTargets.map((target) => (
              <article key={target.label} className="stat-card">
                <span className="stat-label">{target.label}</span>
                <strong>{target.value}</strong>
                <span className="muted">{target.expectation}</span>
              </article>
            ))}
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={() => onTrack(latestAction.result.tx_hash)}>
            Open Tracker For This Action
          </button>
        </div>
      </div>
    </section>
  );
}
