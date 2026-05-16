import type {
  ApiError,
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  StakesResponse,
  StakingAction,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

type StakingActionContextCardProps = {
  address: string;
  summary: WalletSummary | null;
  validator: ValidatorResponse | null;
  stakes: StakesResponse | null;
  checkpoints: CheckpointsResponse | null;
  finalized: LatestFinalizedCheckpoint | null;
  focusAction?: StakingAction;
  loading: boolean;
  error: ApiError | null;
};

export function StakingActionContextCard(props: StakingActionContextCardProps) {
  const { address, summary, validator, stakes, checkpoints, finalized, focusAction, loading, error } = props;
  const normalizedAddress = address.trim();

  const bondedCount = stakes?.stakes.filter((stake) => stake.status === "bonded").length ?? 0;
  const unbondingCount = stakes?.stakes.filter((stake) => stake.status === "unbonding").length ?? 0;
  const latestCheckpointHeight = checkpoints?.latest_checkpoint_height;
  const readyToFinalizeCount =
    stakes?.stakes.filter(
      (stake) =>
        stake.status === "unbonding" &&
        latestCheckpointHeight != null &&
        stake.unlock_requested_height != null &&
        latestCheckpointHeight >= stake.unlock_requested_height + 1
    ).length ?? 0;

  const validatorStatus =
    validator && validator.found
      ? validator.validator.status
      : normalizedAddress
        ? "not registered"
        : "-";
  const availableBalance = summary != null ? Number(summary.available) : 0;

  const nextActionHint = !normalizedAddress
    ? "Set a From address first so staking can show validator and stake context."
    : readyToFinalizeCount > 0
      ? `There ${readyToFinalizeCount === 1 ? "is" : "are"} ${readyToFinalizeCount} unbonding position${readyToFinalizeCount === 1 ? "" : "s"} ready to finalize now.`
      : validator && validator.found && validator.validator.status === "pending"
        ? "This address is registered as pending. A positive self-bond is still required before activation."
        : validator && validator.found && validator.validator.status === "inactive"
          ? "This validator is inactive. Only self-bond or self-rebond can reactivate it."
          : "Use this card to sanity-check balance, nonce, validator status, and stake readiness before submit.";
  const riskSignals = !normalizedAddress
    ? []
    : [
        ...(summary && availableBalance <= 0
          ? [
              "Available balance is at or below zero, so fresh self-bond or delegation attempts are likely to fail until liquidity returns."
            ]
          : []),
        ...(validator && validator.found && validator.validator.status === "pending"
          ? [
              "This validator is still pending. Third-party delegation will not activate it; the operator needs a positive self-bond first."
            ]
          : []),
        ...(validator && validator.found && validator.validator.status === "inactive"
          ? [
              "This validator is inactive. Delegation is not the shortcut back into the active set; only self-bond or self-rebond can reactivate it."
            ]
          : []),
        ...(bondedCount === 0
          ? ["No bonded position is visible right now, so unbond and reward-claim actions are not good first choices from this address context."]
          : []),
        ...(unbondingCount > 0 && readyToFinalizeCount === 0
          ? ["There are unbonding positions, but none are mature yet. Watch finalized checkpoint progress before trying finalize."]
          : []),
        ...(readyToFinalizeCount > 0
          ? [
              `You already have ${readyToFinalizeCount} mature unbonding position${readyToFinalizeCount === 1 ? "" : "s"}, so finalize is likely higher value than opening a new lifecycle step.`
            ]
          : [])
      ];
  const actionFocusTitle =
    focusAction === "validator_register"
      ? "Register focus"
      : focusAction === "stake_bond"
        ? "Bond focus"
        : focusAction === "stake_unbond"
          ? "Unbond focus"
          : focusAction === "stake_unbond_finalize"
            ? "Finalize focus"
            : focusAction === "stake_reward_claim"
              ? "Reward focus"
              : "Action focus";
  const actionFocusSummary =
    focusAction === "validator_register"
      ? "Watch validator visibility and nonce progression first."
      : focusAction === "stake_bond"
        ? "Watch liquidity, validator status, and stake shape together."
        : focusAction === "stake_unbond"
          ? "Watch bonded stake moving into unbonding and checkpoint progress after that."
          : focusAction === "stake_unbond_finalize"
            ? "Watch mature unbonding positions disappear and liquid balance come back."
            : focusAction === "stake_reward_claim"
              ? "Watch reward-related liquidity without disturbing the current bonded shape."
              : "Choose a staking action to see the most relevant context fields.";
  const highlightedFields =
    focusAction === "validator_register"
      ? ["Validator Status", "Suggested Next Nonce"]
      : focusAction === "stake_bond"
        ? ["Available Balance", "Validator Status", "Bonded Positions"]
        : focusAction === "stake_unbond"
          ? ["Bonded Positions", "Unbonding Positions", "Latest Finalized Checkpoint"]
          : focusAction === "stake_unbond_finalize"
            ? ["Ready To Finalize", "Unbonding Positions", "Available Balance"]
            : focusAction === "stake_reward_claim"
              ? ["Available Balance", "Bonded Positions", "Latest Finalized Checkpoint"]
              : [];
  const actionSignals =
    focusAction === "validator_register"
      ? [
          "Validator Status should become visible as pending after confirmation.",
          "Suggested Next Nonce is the safest sequencing field to re-check before the next action."
        ]
      : focusAction === "stake_bond"
        ? [
            "Available Balance is the fastest signal that liquid funds were committed into stake.",
            "Validator Status matters more when this bond is self-bond instead of delegation."
          ]
        : focusAction === "stake_unbond"
          ? [
              "Bonded Positions should eventually give way to more unbonding exposure for this staker.",
              "Latest Finalized Checkpoint becomes the timing signal for when finalize will be viable."
            ]
          : focusAction === "stake_unbond_finalize"
            ? [
                "Ready To Finalize should fall once the mature position is consumed.",
                "Available Balance is the recovery signal that liquid funds have returned."
              ]
            : focusAction === "stake_reward_claim"
              ? [
                  "Available Balance may rise when reward is realized into liquid balance.",
                  "Bonded Positions should normally stay stable if this is only a reward claim."
                ]
              : [];
  const statCards = [
    { label: "Current Address", value: normalizedAddress, accent: true },
    { label: "Available Balance", value: summary?.available ?? "-" },
    { label: "Suggested Next Nonce", value: summary?.next_nonce ?? "-" },
    { label: "Validator Status", value: validatorStatus },
    { label: "Bonded Positions", value: bondedCount },
    { label: "Unbonding Positions", value: unbondingCount },
    { label: "Ready To Finalize", value: readyToFinalizeCount },
    {
      label: "Latest Finalized Checkpoint",
      value: finalized?.found ? finalized.checkpoint_height : latestCheckpointHeight ?? "none"
    }
  ];

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Staking Action Context</h2>
        <span className="muted">{loading ? "Refreshing..." : "Pre-submit read-only snapshot"}</span>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!normalizedAddress ? (
        <div className="empty-state">Choose or paste a From address to unlock validator and stake context.</div>
      ) : (
        <div className="stack gap-md">
          <div className="staking-lifecycle-note">
            <strong>{actionFocusTitle}</strong>
            <span>{actionFocusSummary}</span>
          </div>
          <div className="grid stats-grid">
            {statCards.map((card) => {
              const highlighted = highlightedFields.includes(card.label);
              const className = card.accent
                ? "stat-card accent"
                : highlighted
                  ? "stat-card staking-context-highlight"
                  : "stat-card";

              return (
                <article key={card.label} className={className}>
                  <span className="stat-label">{card.label}</span>
                  {card.label === "Current Address" ? <code className="mono-break">{card.value}</code> : <strong>{card.value}</strong>}
                </article>
              );
            })}
          </div>
          {actionSignals.length > 0 ? (
            <div className="stack gap-sm">
              <div className="panel-header">
                <h2>Action Signals</h2>
                <span className="muted">Fields worth watching for the current staking template</span>
              </div>
              <div className="staking-checks">
                {actionSignals.map((signal) => (
                  <div key={signal} className="staking-check-item">
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="staking-lifecycle-note">
            <strong>Next Action Hint</strong>
            <span>{nextActionHint}</span>
          </div>
          {riskSignals.length > 0 ? (
            <div className="stack gap-sm">
              <div className="panel-header">
                <h2>Risk Signals</h2>
                <span className="muted">Context warnings before you choose a staking action</span>
              </div>
              <div className="staking-checks">
                {riskSignals.map((signal) => (
                  <div key={signal} className="staking-check-item">
                    {signal}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
