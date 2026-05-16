import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiError, Receipt } from "../types/api";
import { getReceipt, getTxStatus } from "../services/tx";
import { canTransition, fromStatusResponse, type TxViewState } from "../types/tx-state";

const POLL_INTERVAL_MS = 2500;

export function useTxPolling(txHash: string, initialState: TxViewState | null = null) {
  const [state, setState] = useState<TxViewState | null>(initialState);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const stateRef = useRef<TxViewState | null>(null);

  const refresh = useCallback(async () => {
    if (!txHash.trim()) {
      setState(null);
      setReceipt(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const statusResponse = await getTxStatus(txHash.trim());
      const nextState = fromStatusResponse(statusResponse);

      if (canTransition(stateRef.current, nextState)) {
        stateRef.current = nextState;
        setState(nextState);
      }

      if (nextState.type === "chain") {
        if (nextState.status === "confirmed") {
          const nextReceipt = await getReceipt(txHash.trim());
          setReceipt(nextReceipt);
        }
        setPollingEnabled(false);
      }
      if (nextState.type === "not_found") {
        setPollingEnabled(false);
      }

      setLastUpdatedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [txHash]);

  useEffect(() => {
    stateRef.current = initialState;
    setState(initialState);
    setReceipt(null);
    setError(null);
    setLastUpdatedAt(null);
    setPollingEnabled(true);
  }, [txHash, initialState]);

  useEffect(() => {
    if (!txHash.trim()) {
      return;
    }

    void refresh();
  }, [txHash, refresh]);

  useEffect(() => {
    if (!txHash.trim() || !pollingEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [txHash, pollingEnabled, refresh]);

  const statusText = useMemo(() => {
    if (!state) {
      return "Waiting For Query";
    }

    if (state.type === "mempool") {
      return state.status === "future" ? "Mempool / Future" : "Mempool / Pending";
    }

    if (state.type === "chain") {
      return state.status === "included" ? "Chain / Included" : "Chain / Confirmed";
    }

    return "Not Found";
  }, [state]);

  return {
    state,
    receipt,
    loading,
    error,
    statusText,
    pollingEnabled,
    lastUpdatedAt,
    setPollingEnabled,
    refresh
  };
}
