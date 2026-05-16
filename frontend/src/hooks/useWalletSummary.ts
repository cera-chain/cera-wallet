import { useCallback, useEffect, useState } from "react";
import type { ApiError, PendingTxItem, WalletSummary } from "../types/api";
import { getPendingTransactions, getWalletSummary } from "../services/wallet";

export function useWalletSummary(address: string) {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingTxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    if (!address.trim()) {
      setSummary(null);
      setPendingItems([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextSummary, nextPending] = await Promise.all([
        getWalletSummary(address.trim()),
        getPendingTransactions(address.trim())
      ]);
      setSummary(nextSummary);
      setPendingItems(nextPending);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    summary,
    pendingItems,
    loading,
    error,
    refresh
  };
}
