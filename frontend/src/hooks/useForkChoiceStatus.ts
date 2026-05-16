import { useEffect, useState } from "react";
import { getForkChoiceStatus } from "../services/wallet";
import type { ApiError, ForkChoiceStatus } from "../types/api";

const POLL_MS = 5000;

export function useForkChoiceStatus() {
  const [status, setStatus] = useState<ForkChoiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const next = await getForkChoiceStatus();
      setStatus(next);
      setError(null);
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return { status, loading, error, refresh };
}
