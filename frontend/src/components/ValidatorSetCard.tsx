import type { ApiError, ValidatorSetResponse } from "../types/api";

type ValidatorSetCardProps = {
  validatorSet: ValidatorSetResponse | null;
  error: ApiError | null;
  loading: boolean;
};

export function ValidatorSetCard(props: ValidatorSetCardProps) {
  const { validatorSet, error, loading } = props;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Validator Set</h2>
        <span className="muted">
          {loading ? "Refreshing..." : `Count: ${validatorSet?.count ?? 0}`}
        </span>
      </div>
      {error ? <div className="field-error">{error.code}: {error.message}</div> : null}
      {!validatorSet || validatorSet.validator_set.length === 0 ? (
        <div className="empty-state">Validator set is currently empty.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Validator</th>
                <th>Voting Power</th>
                <th>Effective Stake</th>
                <th>Active From</th>
              </tr>
            </thead>
            <tbody>
              {validatorSet.validator_set.map((entry) => (
                <tr key={entry.validator_address}>
                  <td><code className="mono-break">{entry.validator_address}</code></td>
                  <td>{String(entry.voting_power)}</td>
                  <td>{String(entry.effective_stake_base_units)}</td>
                  <td>{entry.active_from_height}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
