import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StakingConsoleCard } from "./StakingConsoleCard";
import type {
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  StakesResponse,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

const { getValidator } = vi.hoisted(() => ({
  getValidator: vi.fn()
}));

vi.mock("../services/wallet", () => ({
  getValidator
}));

const summary: WalletSummary = {
  address: "0x1234567890abcdef",
  balance: "1000",
  available: "5",
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
    status: "inactive",
    metadata_version: 1
  },
  validator_set_entry: null,
  bonded_total_base_units: "20",
  stake_count: 2
};

const stakes: StakesResponse = {
  stakes: [
    {
      staker_address: "0x1234567890abcdef",
      validator_address: "0x1234567890abcdef",
      bonded_amount_base_units: "20",
      status: "bonded",
      activated_height: 10,
      unlock_requested_height: null,
      reward_cursor_progress_height: 10,
      pending_reward_display_units: "1"
    },
    {
      staker_address: "0x1234567890abcdef",
      validator_address: "0x1234567890abcdef",
      bonded_amount_base_units: "10",
      status: "unbonding",
      activated_height: 10,
      unlock_requested_height: 8,
      reward_cursor_progress_height: 10,
      pending_reward_display_units: "0"
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

describe("StakingConsoleCard", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  async function render(props?: Partial<React.ComponentProps<typeof StakingConsoleCard>>) {
    await act(async () => {
      renderer = create(
        <StakingConsoleCard
          initialFrom={summary.address}
          suggestedNonce={summary.next_nonce}
          currentSummary={summary}
          currentValidator={validator}
          currentStakes={stakes}
          currentCheckpoints={checkpoints}
          currentFinalized={finalized}
          onTrack={vi.fn()}
          {...props}
        />
      );
    });
  }

  function getButtons() {
    if (!renderer) {
      throw new Error("Renderer not ready.");
    }
    return renderer.root.findAllByType("button");
  }

  function findButton(label: string) {
    const button = getButtons().find((node) => node.children.join("") === label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }
    return button;
  }

  it("recommends finalize when a mature unbonding position exists", async () => {
    await render();

    const rootText = renderer?.root.findAllByType("strong").map((node) => node.children.join(" ")).join(" | ");
    expect(rootText).toContain("Recommended Next Template");
    expect(renderer?.toJSON()).toBeTruthy();
    expect(findButton("Finalize Current Position").props.disabled).toBe(false);
    expect(findButton("Claim Current Reward").props.disabled).toBe(false);
  });

  it("disables templates that do not fit the current context", async () => {
    await render({
      currentSummary: { ...summary, available: "0" },
      currentStakes: { ...stakes, stakes: [] }
    });

    expect(findButton("Self Bond").props.disabled).toBe(true);
    expect(findButton("Unbond Current Position").props.disabled).toBe(true);
    expect(findButton("Finalize Current Position").props.disabled).toBe(true);
    expect(findButton("Claim Current Reward").props.disabled).toBe(true);
  });

  it("emits action changes when the operator switches staking tabs", async () => {
    const onActionChange = vi.fn();
    await render({ onActionChange });

    expect(onActionChange).toHaveBeenLastCalledWith("validator_register");

    await act(async () => {
      findButton("Reward Claim").props.onClick();
    });

    expect(onActionChange).toHaveBeenLastCalledWith("stake_reward_claim");
  });
});
