import { describe, expect, it } from "vitest";
import { canTransition, fromSendResult, fromStatusResponse, getStateLabel } from "./tx-state";

describe("tx-state", () => {
  it("maps send results into mempool states", () => {
    expect(fromSendResult("pending")).toEqual({ type: "mempool", status: "pending" });
    expect(fromSendResult("future")).toEqual({ type: "mempool", status: "future" });
  });

  it("maps status responses without treating included as confirmed", () => {
    expect(fromStatusResponse({ tx_hash: "0x1", status: "included" })).toEqual({
      type: "chain",
      status: "included"
    });
    expect(fromStatusResponse({ tx_hash: "0x1", status: "confirmed" })).toEqual({
      type: "chain",
      status: "confirmed"
    });
    expect(fromStatusResponse({ tx_hash: "0x1", status: "not_found" })).toEqual({ type: "not_found" });
  });

  it("enforces the intended status progression", () => {
    expect(canTransition({ type: "mempool", status: "future" }, { type: "mempool", status: "pending" })).toBe(true);
    expect(canTransition({ type: "mempool", status: "pending" }, { type: "mempool", status: "future" })).toBe(false);
    expect(canTransition({ type: "mempool", status: "pending" }, { type: "not_found" })).toBe(true);
    expect(canTransition({ type: "mempool", status: "future" }, { type: "not_found" })).toBe(true);
    expect(canTransition({ type: "chain", status: "included" }, { type: "chain", status: "confirmed" })).toBe(true);
    expect(canTransition({ type: "chain", status: "confirmed" }, { type: "chain", status: "included" })).toBe(false);
    expect(canTransition({ type: "chain", status: "confirmed" }, { type: "not_found" })).toBe(false);
  });

  it("exposes user-facing labels for each state", () => {
    expect(getStateLabel({ type: "mempool", status: "future" })).toBe("Mempool / Future");
    expect(getStateLabel({ type: "mempool", status: "pending" })).toBe("Mempool / Pending");
    expect(getStateLabel({ type: "chain", status: "included" })).toBe("Chain / Included");
    expect(getStateLabel({ type: "chain", status: "confirmed" })).toBe("Chain / Confirmed");
    expect(getStateLabel({ type: "not_found" })).toBe("Not Found");
  });
});
