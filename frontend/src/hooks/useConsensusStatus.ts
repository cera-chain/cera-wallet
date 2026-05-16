import { useEffect, useState } from "react";
import {
  getCheckpoints,
  getLatestFinalizedCheckpoint,
  getStakingPolicy,
  getStakes,
  getValidator,
  getValidatorSet
} from "../services/wallet";
import type {
  ApiError,
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  StakingPolicy,
  StakesResponse,
  ValidatorResponse,
  ValidatorSetResponse
} from "../types/api";

const POLL_MS = 8000;

export function useConsensusStatus(address: string) {
  const [validatorSet, setValidatorSet] = useState<ValidatorSetResponse | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointsResponse | null>(null);
  const [finalized, setFinalized] = useState<LatestFinalizedCheckpoint | null>(null);
  const [stakingPolicy, setStakingPolicy] = useState<StakingPolicy | null>(null);
  const [validator, setValidator] = useState<ValidatorResponse | null>(null);
  const [stakes, setStakes] = useState<StakesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [addressViewsLoading, setAddressViewsLoading] = useState(false);
  const [addressViewsError, setAddressViewsError] = useState<ApiError | null>(null);
  const normalizedAddress = address.trim();

  async function refresh() {
    setLoading(true);
    try {
      const [nextValidatorSet, nextCheckpoints, nextFinalized, nextStakingPolicy] = await Promise.all([
        getValidatorSet(),
        getCheckpoints(),
        getLatestFinalizedCheckpoint(),
        getStakingPolicy()
      ]);
      setValidatorSet(nextValidatorSet);
      setCheckpoints(nextCheckpoints);
      setFinalized(nextFinalized);
      setStakingPolicy(nextStakingPolicy);
      setError(null);
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAddressViews() {
    if (!normalizedAddress) {
      setValidator(null);
      setStakes(null);
      setAddressViewsError(null);
      setAddressViewsLoading(false);
      return;
    }

    setAddressViewsLoading(true);
    try {
      const [nextValidator, nextStakes] = await Promise.all([
        getValidator(normalizedAddress),
        getStakes({ staker_address: normalizedAddress, limit: 12 })
      ]);
      setValidator(nextValidator);
      setStakes(nextStakes);
      setAddressViewsError(null);
    } catch (nextError) {
      setAddressViewsError(nextError as ApiError);
    } finally {
      setAddressViewsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void refreshAddressViews();
    const timer = window.setInterval(() => {
      void refreshAddressViews();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [normalizedAddress]);

  async function refreshAll() {
    await Promise.all([refresh(), refreshAddressViews()]);
  }

  return {
    validatorSet,
    checkpoints,
    finalized,
    stakingPolicy,
    validator,
    stakes,
    loading,
    error,
    addressViewsLoading,
    addressViewsError,
    refresh: refreshAll
  };
}
