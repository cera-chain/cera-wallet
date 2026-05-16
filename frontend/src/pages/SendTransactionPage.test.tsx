import React from "react";
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendTransactionPage } from "./SendTransactionPage";
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

const validator: ValidatorResponse = {
  found: true,
  validator: {
    validator_address: "0x1234567890abcdef",
    consensus_public_key: "consensus-key",
    status: "active",
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

function readText(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string {
  if (!node) {
    return "";
  }
  if (Array.isArray(node)) {
    return node.map((child) => readText(child)).join(" ");
  }
  const children = node.children ?? [];
  return children
    .map((child) => (typeof child === "string" ? child : readText(child)))
    .join(" ");
}

describe("SendTransactionPage", () => {
  let renderer: ReactTestRenderer | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  async function render() {
    const onTrack = vi.fn();
    await act(async () => {
      renderer = create(
        <SendTransactionPage
          fromAddress={summary.address}
          suggestedNonce={summary.next_nonce}
          sendModeLabel="Staking flow from dashboard context"
          onSubmit={vi.fn(async () => undefined)}
          sending={false}
          error={null}
          result={{ tx_hash: "0xsend", mempool_status: "pending" }}
          recentSends={[
            { tx_hash: "0xrecent", mempool_status: "pending", createdAt: "10:00:00", label: "transfer" }
          ]}
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
          onTrack={onTrack}
        />
      );
    });
    return { onTrack };
  }

  function findButton(label: string) {
    if (!renderer) {
      throw new Error("Renderer not ready.");
    }
    const button = renderer.root.findAllByType("button").find((node) => node.children.join("") === label);
    if (!button) {
      throw new Error(`Button not found: ${label}`);
    }
    return button;
  }

  it("routes tracker shortcuts from result, staking follow-up, and recent sends", async () => {
    const { onTrack } = await render();

    await act(async () => {
      findButton("Open Tracker").props.onClick();
    });
    await act(async () => {
      findButton("Open Tracker For This Action").props.onClick();
    });
    await act(async () => {
      findButton("Track").props.onClick();
    });

    expect(onTrack).toHaveBeenNthCalledWith(1, "0xsend");
    expect(onTrack).toHaveBeenNthCalledWith(2, "0xstake");
    expect(onTrack).toHaveBeenNthCalledWith(3, "0xrecent");
  });

  it("keeps staking context aligned when the active staking action changes", async () => {
    await render();

    expect(readText(renderer?.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null)).toContain("Register focus");

    await act(async () => {
      findButton("Unbond Finalize").props.onClick();
    });

    const updatedText = readText(renderer?.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null);
    expect(updatedText).toContain("Finalize focus");
    expect(updatedText).toContain("Ready To Finalize should fall once the mature position is consumed.");
    expect(updatedText).toContain("Watch mature unbonding positions disappear and liquid balance come back.");
  });
});
