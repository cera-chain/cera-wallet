import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTxPolling } from "./useTxPolling";
import type { TxViewState } from "../types/tx-state";

const { getTxStatus, getReceipt } = vi.hoisted(() => ({
  getTxStatus: vi.fn(),
  getReceipt: vi.fn()
}));

vi.mock("../services/tx", () => ({
  getTxStatus,
  getReceipt
}));

type HookHostProps = {
  txHash: string;
  initialState?: TxViewState | null;
  onValue: (value: ReturnType<typeof useTxPolling>) => void;
};

function HookHost({ txHash, initialState = null, onValue }: HookHostProps) {
  onValue(useTxPolling(txHash, initialState));
  return null;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useTxPolling", () => {
  let renderer: ReactTestRenderer | null = null;
  let currentValue: ReturnType<typeof useTxPolling> | null = null;

  beforeEach(() => {
    vi.stubGlobal("window", {
      setInterval,
      clearInterval
    });
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    currentValue = null;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function render(txHash: string, initialState: TxViewState | null = null) {
    await act(async () => {
      renderer = create(
        <HookHost txHash={txHash} initialState={initialState} onValue={(value) => void (currentValue = value)} />
      );
    });
    await flushAsyncWork();
  }

  function getCurrent() {
    if (!currentValue) {
      throw new Error("Hook value is not available yet.");
    }
    return currentValue;
  }

  it("loads confirmed status, fetches the receipt, and disables polling", async () => {
    getTxStatus.mockResolvedValue({ tx_hash: "0xabc", status: "confirmed" });
    getReceipt.mockResolvedValue({
      tx_hash: "0xabc",
      block_height: 2,
      status: "success",
      from: "0x1234567890abcdef",
      to: "0xabcdef1234567890",
      amount: 7,
      gas_used: 1,
      logs: []
    });

    await render("0xabc");

    expect(getCurrent().state).toEqual({ type: "chain", status: "confirmed" });
    expect(getReceipt).toHaveBeenCalledWith("0xabc");
    expect(getCurrent().receipt?.block_height).toBe(2);
    expect(getCurrent().pollingEnabled).toBe(false);
    expect(getCurrent().statusText).toBe("Chain / Confirmed");
  });

  it("preserves allowed forward transitions when refresh is called again", async () => {
    getTxStatus
      .mockResolvedValueOnce({ tx_hash: "0xabc", status: "pending" })
      .mockResolvedValueOnce({ tx_hash: "0xabc", status: "included" });

    await render("0xabc", { type: "mempool", status: "future" });
    expect(getCurrent().state).toEqual({ type: "mempool", status: "pending" });

    await act(async () => {
      await getCurrent().refresh();
    });
    await flushAsyncWork();

    expect(getCurrent().state).toEqual({ type: "chain", status: "included" });
    expect(getCurrent().statusText).toBe("Chain / Included");
  });

  it("accepts not_found after a mempool initial state and stops polling", async () => {
    getTxStatus.mockResolvedValue({ tx_hash: "0xabc", status: "not_found" });

    await render("0xabc", { type: "mempool", status: "pending" });

    expect(getCurrent().state).toEqual({ type: "not_found" });
    expect(getCurrent().pollingEnabled).toBe(false);
    expect(getCurrent().statusText).toBe("Not Found");
  });

  it("resets state for blank tx hashes", async () => {
    await render("   ", { type: "mempool", status: "pending" });

    await act(async () => {
      await getCurrent().refresh();
    });
    await flushAsyncWork();

    expect(getTxStatus).not.toHaveBeenCalled();
    expect(getCurrent().state).toBeNull();
    expect(getCurrent().receipt).toBeNull();
    expect(getCurrent().error).toBeNull();
    expect(getCurrent().statusText).toBe("Waiting For Query");
  });

  it("surfaces polling errors", async () => {
    getTxStatus.mockRejectedValue({ code: "HTTP_ERROR", message: "no status" });

    await render("0xabc");

    expect(getCurrent().error).toEqual({
      code: "HTTP_ERROR",
      message: "no status"
    });
    expect(getCurrent().loading).toBe(false);
  });
});
