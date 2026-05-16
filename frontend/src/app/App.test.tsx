import React from "react";
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
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

const {
  mockUseApiHealth,
  mockUseForkChoiceStatus,
  mockUseConsensusStatus,
  mockUseWalletSummary,
  mockUseTxPolling
} = vi.hoisted(() => ({
  mockUseApiHealth: vi.fn(),
  mockUseForkChoiceStatus: vi.fn(),
  mockUseConsensusStatus: vi.fn(),
  mockUseWalletSummary: vi.fn(),
  mockUseTxPolling: vi.fn()
}));

vi.mock("../hooks/useApiHealth", () => ({
  useApiHealth: mockUseApiHealth
}));

vi.mock("../hooks/useForkChoiceStatus", () => ({
  useForkChoiceStatus: mockUseForkChoiceStatus
}));

vi.mock("../hooks/useConsensusStatus", () => ({
  useConsensusStatus: mockUseConsensusStatus
}));

vi.mock("../hooks/useWalletSummary", () => ({
  useWalletSummary: mockUseWalletSummary
}));

vi.mock("../hooks/useTxPolling", () => ({
  useTxPolling: mockUseTxPolling
}));

vi.mock("../services/wallet", () => ({
  getApiBaseUrl: () => "http://127.0.0.1:3000",
  createWalletAccount: vi.fn(),
  importPrivateKeyWalletAccount: vi.fn(),
  importMnemonicWalletAccount: vi.fn(),
  registerWalletAccount: vi.fn()
}));

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
const checkpoints: CheckpointsResponse = { checkpoints: [], count: 0, latest_checkpoint_height: 10 };
const finalized: LatestFinalizedCheckpoint = {
  found: true,
  checkpoint_height: 10,
  block_hash: "0xblock",
  status: "finalized",
  created_at_height: 10
};
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
const validator: ValidatorResponse = {
  found: true,
  validator: {
    validator_address: summary.address,
    consensus_public_key: "consensus-key",
    status: "active",
    metadata_version: 1
  },
  validator_set_entry: {
    validator_address: summary.address,
    voting_power: "20",
    effective_stake_base_units: "20",
    active_from_height: 5
  },
  bonded_total_base_units: "20",
  stake_count: 1
};
const stakes: StakesResponse = {
  stakes: [
    {
      staker_address: summary.address,
      validator_address: summary.address,
      bonded_amount_base_units: "20",
      status: "bonded",
      activated_height: 10,
      unlock_requested_height: null,
      reward_cursor_progress_height: 10,
      pending_reward_display_units: "1"
    }
  ],
  count: 1,
  validator_address: summary.address,
  staker_address: summary.address,
  latest_progress_height: 12
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

describe("App", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    mockUseApiHealth.mockReturnValue({
      health,
      loading: false,
      error: null,
      refresh: vi.fn(async () => undefined)
    });
    mockUseForkChoiceStatus.mockReturnValue({
      status: forkChoiceStatus,
      loading: false,
      error: null,
      refresh: vi.fn(async () => undefined)
    });
    mockUseConsensusStatus.mockReturnValue({
      validatorSet,
      checkpoints,
      finalized,
      stakingPolicy,
      validator,
      stakes,
      loading: false,
      error: null,
      addressViewsLoading: false,
      addressViewsError: null,
      refresh: vi.fn(async () => undefined)
    });
    mockUseWalletSummary.mockReturnValue({
      summary,
      pendingItems: [],
      loading: false,
      error: null,
      refresh: vi.fn(async () => undefined)
    });
    mockUseTxPolling.mockReturnValue({
      state: null,
      receipt: null,
      loading: false,
      error: null,
      statusText: "Waiting For Query",
      pollingEnabled: true,
      lastUpdatedAt: null,
      setPollingEnabled: vi.fn(),
      refresh: vi.fn(async () => undefined)
    });
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  async function renderApp() {
    await act(async () => {
      renderer = create(<App />);
    });
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

  function findInput(placeholder: string) {
    if (!renderer) {
      throw new Error("Renderer not ready.");
    }
    const input = renderer.root.findAllByType("input").find((node) => node.props.placeholder === placeholder);
    if (!input) {
      throw new Error(`Input not found: ${placeholder}`);
    }
    return input;
  }

  it("opens the send page in staking mode from dashboard quick actions", async () => {
    await renderApp();

    await act(async () => {
      findButton("Open Staking With This Address").props.onClick();
    });

    const text = readText(renderer?.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null);
    expect(text).toContain("Current Send Context");
    expect(text).toContain("Staking flow from dashboard context");
    expect(text).toContain(summary.address);
    expect(text).toContain("Staking Action Context");
  });

  it("opens the send page from validator-scoped dashboard actions", async () => {
    await renderApp();

    await act(async () => {
      findInput("0x...").props.onChange({ target: { value: summary.address } });
    });

    await act(async () => {
      findButton("Open Staking For This Validator").props.onClick();
    });

    const text = readText(renderer?.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null);
    expect(text).toContain("Current Send Context");
    expect(text).toContain("Staking flow from dashboard context");
    expect(text).toContain("Staking Console");
    expect(text).toContain("Recommended Next Template");
  });
});
