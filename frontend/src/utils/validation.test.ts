import { describe, expect, it } from "vitest";
import { validateSendTxPayload } from "./validation";

describe("validateSendTxPayload", () => {
  it("accepts a valid transfer payload", () => {
    expect(
      validateSendTxPayload({
        from: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        to: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        amount: "7",
        fee: "1",
        privateKey: "1234567890abcdef1234567890abcdef",
        nonce: 4
      })
    ).toEqual({});
  });

  it("rejects malformed addresses and numeric fields", () => {
    expect(
      validateSendTxPayload({
        from: "bad-from",
        to: "bad-to",
        amount: "0",
        fee: "-1",
        privateKey: "short",
        nonce: -1
      })
    ).toEqual({
      from: "From address format is invalid. Expected cera1... or legacy 0x address.",
      to: "To address format is invalid. Expected cera1... or legacy 0x address.",
      amount: "Amount must be a number greater than 0.",
      fee: "Fee must be a number greater than 0.",
      privateKey: "Private key is too short to be used as signing material.",
      nonce: "Nonce must be an integer greater than or equal to 0."
    });
  });
});
