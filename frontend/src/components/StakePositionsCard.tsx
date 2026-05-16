import type { ApiError, CheckpointsResponse, StakesResponse } from "../types/api";

type StakePositionsCardProps = {
  address: string;
  stakes: StakesResponse | null;
  checkpoints: CheckpointsResponse | null;
  error: ApiError | null;
  loading: boolean;
  onOpenStaking?: (address: string) => void;
};

export function StakePositionsCard(props: StakePositionsCardProps) {
  const { address, stakes, checkpoints, error, loading, onOpenStaking } = props;
  const normalizedAddress = address.trim();
  const latestCheckpointHeight = checkpoints?.latest_checkpoint_height;
  const bondedCount = stakes?.stakes.filter((stake) => stake.status === "bonded").length ?? 0;
  const unbondingCount = stakes?.stakes.filter((stake) => stake.status === "unbonding").length ?? 0;
  const readyToFinalizeCount =
    stakes?.stakes.filter(
      (stake) =>
        stake.status === "unbonding" &&
        latestCheckpointHeight != null &&
        stake.unlock_requested_height != null &&
        latestCheckpointHeight >= stake.unlock_requested_height + 1
    ).length ?? 0;

  function stakeStatusClass(status: string) {
    if (status === "bonded") return "pill pill-confirmed";
    if (status === "unbonding") return "pill pill-future";
    return "pill";
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Stake Positions</h2>
        <span className="muted">
          {loading ? "Refreshing..." : `Count: ${stakes?.count ?? 0}`}
        </span>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!normalizedAddress ? (
        <div className="empty-state">Enter an address to inspect stake positions owned by that staker.</div>
      ) : !stakes || stakes.stakes.length === 0 ? (
        <div className="empty-state">
          No stake positions were found for <code className="mono-break">{normalizedAddress}</code>.
        </div>
      ) : (
        <div className="stack gap-md">
          <div className="grid stats-grid">
            <article className="stat-card">
              <span className="stat-label">Bonded</span>
              <strong>{bondedCount}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Unbonding</span>
              <strong>{unbondingCount}</strong>
            </article>
            <article className="stat-card accent">
              <span className="stat-label">Ready To Finalize</span>
              <strong>{readyToFinalizeCount}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Latest Checkpoint</span>
              <strong>{latestCheckpointHeight ?? "none"}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Latest Progress</span>
              <strong>{stakes.latest_progress_height}</strong>
            </article>
          </div>
          <div className="staking-lifecycle-note">
            <strong>Lifecycle</strong>
            <span>Bonded to unbonding, then finalized release back to liquid balance.</span>
          </div>
          {onOpenStaking ? (
            <div className="actions">
              <button type="button" className="secondary" onClick={() => onOpenStaking(normalizedAddress)}>
                Open Staking For This Staker
              </button>
            </div>
          ) : null}
          <div className="staking-lifecycle-note">
            <strong>Reward Window</strong>
            <span>
              `pending reward` stays at 0 until enough finalized progress accrues after the current reward cursor. That
              includes validator reactivation and later delegation re-entry windows.
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Validator</th>
                  <th>Status</th>
                  <th>Bonded</th>
                  <th>Activated</th>
                  <th>Reward Cursor</th>
                  <th>Pending Reward</th>
                  <th>Unlock Requested</th>
                  <th>Finalize Readiness</th>
                </tr>
              </thead>
              <tbody>
                {stakes.stakes.map((stake) => {
                  const readyToFinalize =
                    stake.status === "unbonding" &&
                    latestCheckpointHeight != null &&
                    stake.unlock_requested_height != null &&
                    latestCheckpointHeight >= stake.unlock_requested_height + 1;

                  return (
                    <tr key={`${stake.staker_address}-${stake.validator_address}-${stake.status}`}>
                      <td><code className="mono-break">{stake.validator_address}</code></td>
                      <td><span className={stakeStatusClass(stake.status)}>{stake.status}</span></td>
                      <td>{String(stake.bonded_amount_base_units)}</td>
                      <td>{stake.activated_height ?? "pending"}</td>
                      <td>{stake.reward_cursor_progress_height ?? "none"}</td>
                      <td>{String(stake.pending_reward_display_units)}</td>
                      <td>{stake.unlock_requested_height ?? "none"}</td>
                      <td>
                        {stake.status === "unbonding"
                          ? readyToFinalize
                            ? "ready now"
                            : "waiting checkpoint"
                          : "n/a"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
