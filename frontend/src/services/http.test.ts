import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, postJson, subscribeDebugLog } from "./http";

describe("http helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON and emits request/response debug entries", async () => {
    const entries: Array<{ kind: string; label: string }> = [];
    const unsubscribe = subscribeDebugLog((entry) => {
      entries.push({ kind: entry.kind, label: entry.label });
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true })
      }))
    );

    await expect(getJson("http://unit.test/health", "wallet.health")).resolves.toEqual({ ok: true });
    unsubscribe();

    expect(entries).toEqual([
      { kind: "request", label: "wallet.health" },
      { kind: "response", label: "wallet.health" }
    ]);
  });

  it("normalizes backend errors for post requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: "ERR_TX_ALREADY_EXISTS", message: "duplicate" })
      }))
    );

    await expect(postJson("http://unit.test/send", { amount: 1 }, "tx.send")).rejects.toEqual({
      code: "ERR_TX_ALREADY_EXISTS",
      message: "duplicate"
    });
  });
});
