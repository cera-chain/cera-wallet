import type { MempoolStatus, TxStatusResponse } from "./api";

export type TxViewState =
  | { type: "mempool"; status: "pending" | "future" }
  | { type: "chain"; status: "included" | "confirmed" }
  | { type: "not_found" };

export function fromSendResult(mempoolStatus: MempoolStatus): TxViewState {
  return { type: "mempool", status: mempoolStatus };
}

export function fromStatusResponse(input: TxStatusResponse): TxViewState {
  switch (input.status) {
    case "pending":
      return { type: "mempool", status: "pending" };
    case "included":
      return { type: "chain", status: "included" };
    case "confirmed":
      return { type: "chain", status: "confirmed" };
    case "not_found":
    default:
      return { type: "not_found" };
  }
}

export function getStateLabel(state: TxViewState): string {
  if (state.type === "mempool") {
    return state.status === "future" ? "Mempool / Future" : "Mempool / Pending";
  }

  if (state.type === "chain") {
    return state.status === "included" ? "Chain / Included" : "Chain / Confirmed";
  }

  return "Not Found";
}

export function canTransition(prev: TxViewState | null, next: TxViewState): boolean {
  if (!prev) {
    return true;
  }

  if (prev.type === "not_found") {
    return true;
  }

  if (next.type === "not_found") {
    return prev.type === "mempool";
  }

  if (prev.type === "mempool" && prev.status === "future") {
    return (
      (next.type === "mempool" && (next.status === "future" || next.status === "pending")) ||
      (next.type === "chain" && (next.status === "included" || next.status === "confirmed"))
    );
  }

  if (prev.type === "mempool" && prev.status === "pending") {
    return (
      (next.type === "mempool" && next.status === "pending") ||
      (next.type === "chain" && (next.status === "included" || next.status === "confirmed"))
    );
  }

  if (prev.type === "chain" && prev.status === "included") {
    return next.type === "chain" && (next.status === "included" || next.status === "confirmed");
  }

  if (prev.type === "chain" && prev.status === "confirmed") {
    return next.type === "chain" && next.status === "confirmed";
  }

  return false;
}
