import type { ApiError } from "../types/api";

const ERROR_COPY: Record<string, string> = {
  ERR_NONCE_TOO_LOW: "Nonce is too low. Refresh summary and try again.",
  ERR_NONCE_TOO_HIGH: "Nonce is ahead of chain state and may enter the future queue.",
  ERR_INSUFFICIENT_BALANCE: "Insufficient balance. The chain rejected this submission.",
  ERR_FUTURE_NONCE_LIMIT: "The future queue is full. Wait for earlier transactions to advance.",
  ERR_TX_ALREADY_EXISTS: "This transaction already exists in chain state or the mempool.",
  ERR_MEMPOOL_FULL: "The node mempool is full. Try again later.",
  ERR_INVALID_SIGNATURE: "Signature verification failed. Check the private key and account mode.",
  HTTP_ERROR: "Request failed. Check whether the wallet API is running."
};

export function getFriendlyErrorMessage(error: ApiError | null): string | null {
  if (!error) {
    return null;
  }

  if (error.code === "TX_INPUT_ERROR" && error.message.startsWith("INSUFFICIENT_BALANCE:")) {
    return ERROR_COPY.ERR_INSUFFICIENT_BALANCE;
  }

  return ERROR_COPY[error.code] ?? error.message;
}
