import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWalletSummary } from "./useWalletSummary";

const { getWalletSummary, getPendingTransactions } = vi.hoisted(() => ({
  getWalletSummary: vi.fn(),
  getPendingTransactions: vi.fn()
}));

vi.mock("../services/wallet", () => ({
  getWalletSummary,
  getPendingTransactions
}));

type HookHostProps = {
  address: string;
  onValue: (value: ReturnType<typeof useWalletSummary>) => void;
};

function HookHost({ address, onValue }: HookHostProps) {
  onValue(useWalletSummary(address));
  return null;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWalletSummary", () => {
  let renderer: ReactTestRenderer | null = null;
  let currentValue: ReturnType<typeof useWalletSummary> | null = null;

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    currentValue = null;
    vi.clearAllMocks();
  });

  async function render(address: string) {
    await act(async () => {
      renderer = create(<HookHost address={address} onValue={(value) => void (currentValue = value)} />);
    });
    await flushAsyncWork();
  }

  function getCurrent() {
    if (!currentValue) {
      throw new Error("Hook value is not available yet.");
    }
    return currentValue;
  }

  it("loads summary and pending items for a valid address", async () => {
    getWalletSummary.mockResolvedValue({
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
    });
    getPendingTransactions.mockResolvedValue([
      {
        hash: "0xabc",
        nonce: 4,
        to: "0xabcdef1234567890",
        value: "7",
        fee: "1",
        status: "pending",
        mempool_status: "pending"
      }
    ]);

    await render("0x1234567890abcdef");

    expect(getWalletSummary).toHaveBeenCalledWith("0x1234567890abcdef");
    expect(getPendingTransactions).toHaveBeenCalledWith("0x1234567890abcdef");
    expect(getCurrent().summary?.next_nonce).toBe(4);
    expect(getCurrent().pendingItems).toHaveLength(1);
    expect(getCurrent().error).toBeNull();
    expect(getCurrent().loading).toBe(false);
  });

  it("clears state and skips requests for an empty address", async () => {
    await render("   ");

    expect(getWalletSummary).not.toHaveBeenCalled();
    expect(getPendingTransactions).not.toHaveBeenCalled();
    expect(getCurrent().summary).toBeNull();
    expect(getCurrent().pendingItems).toEqual([]);
    expect(getCurrent().error).toBeNull();
  });

  it("exposes request failures", async () => {
    getWalletSummary.mockRejectedValue({ code: "HTTP_ERROR", message: "boom" });
    getPendingTransactions.mockResolvedValue([]);

    await render("0x1234567890abcdef");

    expect(getCurrent().error).toEqual({
      code: "HTTP_ERROR",
      message: "boom"
    });
    expect(getCurrent().loading).toBe(false);
  });

  it("reloads when the address changes", async () => {
    getWalletSummary
      .mockResolvedValueOnce({
        address: "0x1111111111111111",
        balance: "10",
        available: "10",
        pending_out: "0",
        pending_in: "0",
        locked_balance: "0",
        next_nonce: 1,
        block_height: 1,
        account_auth_mode: "single",
        account_type: "user",
        account_key_count: 1,
        pq_key_count: 0
      })
      .mockResolvedValueOnce({
        address: "0x2222222222222222",
        balance: "20",
        available: "18",
        pending_out: "1",
        pending_in: "0",
        locked_balance: "1",
        next_nonce: 2,
        block_height: 2,
        account_auth_mode: "single",
        account_type: "user",
        account_key_count: 1,
        pq_key_count: 0
      });
    getPendingTransactions.mockResolvedValue([]);

    await render("0x1111111111111111");
    expect(getCurrent().summary?.address).toBe("0x1111111111111111");

    await act(async () => {
      renderer?.update(<HookHost address="0x2222222222222222" onValue={(value) => void (currentValue = value)} />);
    });
    await flushAsyncWork();

    expect(getCurrent().summary?.address).toBe("0x2222222222222222");
    expect(getWalletSummary).toHaveBeenNthCalledWith(1, "0x1111111111111111");
    expect(getWalletSummary).toHaveBeenNthCalledWith(2, "0x2222222222222222");
  });
});
