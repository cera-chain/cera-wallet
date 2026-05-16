import { describe, expect, it } from "vitest";
import { getFriendlyErrorMessage } from "./errors";

describe("getFriendlyErrorMessage", () => {
  it("maps known error codes to stable copy", () => {
    expect(getFriendlyErrorMessage({ code: "ERR_NONCE_TOO_LOW", message: "raw" })).toBe(
      "Nonce is too low. Refresh summary and try again."
    );
    expect(getFriendlyErrorMessage({ code: "ERR_NONCE_TOO_HIGH", message: "raw" })).toBe(
      "Nonce is ahead of chain state and may enter the future queue."
    );
  });

  it("special-cases insufficient balance input errors", () => {
    expect(
      getFriendlyErrorMessage({
        code: "TX_INPUT_ERROR",
        message: "INSUFFICIENT_BALANCE: sender 1 < total cost 2"
      })
    ).toBe("Insufficient balance. The chain rejected this submission.");
  });

  it("falls back to the backend message when no mapping exists", () => {
    expect(getFriendlyErrorMessage({ code: "SOMETHING_NEW", message: "backend says no" })).toBe("backend says no");
  });
});
