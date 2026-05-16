import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StakingActionContextCard } from "./StakingActionContextCard";
import type {
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  StakesResponse,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

const summary: WalletSummary = {
  address: "0x1234567890abcdef",
  balance: "1000",
  available: "0",
  pending_out: "0",
  pending_in: "0",
  locked_balance: "0",
  next_nonce: 7,
  block_height: 12,
  account_auth_mode: "single",
  account_type: "user",
  account_key_count: 1,
  pq_key_count: 0
};

const validator: ValidatorResponse = {
  found: true,
  validator: {
    validator_address: "0x1234567890abcdef",
    consensus_public_key: "consensus-key",
    status: "pending",
    metadata_version: 1
  },
  validator_set_entry: null,
  bonded_total_base_units: "0",
  stake_count: 2
};

const stakes: StakesResponse = {
  stakes: [
    {
      staker_address: "0x1234567890abcdef",
      validator_address: "0x1234567890abcdef",
      bonded_amount_base_units: "50",
      status: "unbonding",
      activated_height: 10,
      unlock_requested_height: 8,
      reward_cursor_progress_height: 10,
      pending_reward_display_units: "0"
    },
    {
      staker_address: "0x1234567890abcdef",
      validator_address: "0x1234567890abcdef",
      bonded_amount_base_units: "20",
      status: "bonded",
      activated_height: 10,
      unlock_requested_height: null,
      reward_cursor_progress_height: 10,
      pending_reward_display_units: "1"
    }
  ],
  count: 2,
  validator_address: "0x1234567890abcdef",
  staker_address: "0x1234567890abcdef",
  latest_progress_height: 12
};

const checkpoints: CheckpointsResponse = {
  checkpoints: [],
  count: 0,
  latest_checkpoint_height: 10
};

const finalized: LatestFinalizedCheckpoint = {
  found: true,
  checkpoint_height: 10,
  block_hash: "0xblock",
  status: "finalized",
  created_at_height: 10
};

describe("StakingActionContextCard", () => {
  it("surfaces finalize-focused action signals and highlights relevant fields", () => {
    const html = renderToStaticMarkup(
      <StakingActionContextCard
        address={summary.address}
        summary={summary}
        validator={validator}
        stakes={stakes}
        checkpoints={checkpoints}
        finalized={finalized}
        focusAction="stake_unbond_finalize"
        loading={false}
        error={null}
      />
    );

    expect(html).toContain("Finalize focus");
    expect(html).toContain("Action Signals");
    expect(html).toContain("Ready To Finalize should fall once the mature position is consumed.");
    expect(html).toContain('staking-context-highlight"><span class="stat-label">Ready To Finalize');
    expect(html).toContain('staking-context-highlight"><span class="stat-label">Available Balance');
  });

  it("shows context-driven risk signals before action submission", () => {
    const html = renderToStaticMarkup(
      <StakingActionContextCard
        address={summary.address}
        summary={summary}
        validator={validator}
        stakes={stakes}
        checkpoints={checkpoints}
        finalized={finalized}
        focusAction="stake_bond"
        loading={false}
        error={null}
      />
    );

    expect(html).toContain("Risk Signals");
    expect(html).toContain("Available balance is at or below zero");
    expect(html).toContain("Third-party delegation will not activate it");
    expect(html).toContain("finalize is likely higher value than opening a new lifecycle step");
  });
});
