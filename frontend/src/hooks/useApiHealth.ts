import { useCallback, useEffect, useState } from "react";
import type { ApiError, HealthResponse } from "../types/api";
import { getHealth } from "../services/wallet";

export function useApiHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextHealth = await getHealth();
      setHealth(nextHealth);
    } catch (err) {
      setHealth(null);
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    health,
    loading,
    error,
    refresh
  };
}
