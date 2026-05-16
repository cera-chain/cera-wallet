import type { ApiError, StakingPolicy } from "../types/api";

type StakingPolicyCardProps = {
  policy: StakingPolicy | null;
  error: ApiError | null;
  loading: boolean;
  onRefresh: () => void;
};

export function StakingPolicyCard(props: StakingPolicyCardProps) {
  const { policy, error, loading, onRefresh } = props;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Effective Staking Policy</h2>
        <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!policy ? (
        <div className="empty-state">No staking policy snapshot is currently available.</div>
      ) : (
        <div className="grid stats-grid">
          <div className="stat-card">
            <span className="stat-label">Token</span>
            <strong>{policy.token_symbol}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Decimals</span>
            <strong>{policy.token_decimals}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Chain ID</span>
            <strong>{policy.mainnet_chain_id}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Unbond Delay</span>
            <strong>{policy.min_unbonding_checkpoint_delay} checkpoint</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Reward Per Progress</span>
            <strong>{policy.reward_per_progress_height_display_units} {policy.token_symbol}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Reward Stake Unit</span>
            <strong>{policy.reward_stake_unit_display_units} {policy.token_symbol}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Reward Min Progress</span>
            <strong>{policy.reward_min_progress_heights}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Validator Required</span>
            <strong>{policy.reward_requires_active_validator_set ? "Yes" : "No"}</strong>
          </div>
          <div className="stat-card accent staking-policy-wide">
            <span className="stat-label">Accrual Start</span>
            <code className="mono-break">{policy.reward_activation_start}</code>
          </div>
        </div>
      )}
    </section>
  );
}
