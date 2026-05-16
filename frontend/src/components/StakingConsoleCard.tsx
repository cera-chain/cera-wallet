import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SendResultCard } from "./SendResultCard";
import { getValidator } from "../services/wallet";
import { sendStakingTransaction } from "../services/tx";
import type {
  ApiError,
  CheckpointsResponse,
  LatestFinalizedCheckpoint,
  SendTxResponse,
  StakesResponse,
  StakingAction,
  ValidatorResponse,
  WalletSummary
} from "../types/api";

type StakingConsoleCardProps = {
  initialFrom?: string;
  suggestedNonce?: number | null;
  currentSummary?: WalletSummary | null;
  currentValidator?: ValidatorResponse | null;
  currentStakes?: StakesResponse | null;
  currentCheckpoints?: CheckpointsResponse | null;
  currentFinalized?: LatestFinalizedCheckpoint | null;
  onTrack: (txHash: string) => void;
  onActionChange?: (action: StakingAction) => void;
  onSuccess?: (result: SendTxResponse, meta: { action: StakingAction; from?: string }) => void;
};

type FormState = {
  action: StakingAction;
  from: string;
  validatorAddress: string;
  amount: string;
  fee: string;
  privateKey: string;
  pqPrivateKey: string;
  consensusPublicKey: string;
  nonce: string;
};

type ValidationErrors = Partial<Record<keyof Omit<FormState, "action"> | "form", string>>;

type ActionProductCopy = {
  title: string;
  summary: string;
  operatorHint: string;
  nextStep: string;
};

type QuickTemplate = {
  key: string;
  label: string;
  disabled?: boolean;
  note: string;
  emphasized?: boolean;
  action: () => void;
};

function isLikelyAddress(value: string) {
  return /^0x[a-fA-F0-9]{16,}$/.test(value);
}

function isPositiveIntegerString(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function actionLabel(action: StakingAction) {
  switch (action) {
    case "validator_register":
      return "Validator Register";
    case "stake_bond":
      return "Stake Bond";
    case "stake_unbond":
      return "Stake Unbond";
    case "stake_unbond_finalize":
      return "Unbond Finalize";
    case "stake_reward_claim":
      return "Reward Claim";
  }
}

function getActionProductCopy(action: StakingAction, isSelfBondAttempt: boolean): ActionProductCopy {
  switch (action) {
    case "validator_register":
      return {
        title: "Create A Pending Validator Record",
        summary: "Registration only creates the validator identity. It does not make the validator active yet.",
        operatorHint: "Use the validator operator address and signing key for the validator you want to register.",
        nextStep: "After registration, submit a positive self-bond before expecting validator-set activity or rewards."
      };
    case "stake_bond":
      return {
        title: isSelfBondAttempt ? "Self-Bond This Validator" : "Delegate To A Validator",
        summary: isSelfBondAttempt
          ? "Self-bond can activate a pending validator or reactivate an inactive validator."
          : "Delegation adds stake, but it does not activate or reactivate a validator by itself.",
        operatorHint: isSelfBondAttempt
          ? "Set From and Validator Address to the same validator operator address for self-bond."
          : "Use your delegator address in From and the validator target in Validator Address.",
        nextStep: "Track the transaction and wait for finalized progress before expecting reward-claim availability."
      };
    case "stake_unbond":
      return {
        title: "Move Bonded Stake Into Unbonding",
        summary: "Unbond removes effective stake from the active position and starts the release countdown.",
        operatorHint: "Use the same staker identity that owns the current bonded position.",
        nextStep: "Watch stake positions and finalized checkpoints, then use Unbond Finalize when the release window is ready."
      };
    case "stake_unbond_finalize":
      return {
        title: "Finalize An Unbonding Position",
        summary: "Finalize releases a mature unbonding position back into liquid balance.",
        operatorHint: "Only the staker that created the unbonding position can finalize it.",
        nextStep: "After finalize succeeds, refresh wallet summary and stake positions to confirm the liquidity is back."
      };
    case "stake_reward_claim":
      return {
        title: "Claim Accrued Staking Reward",
        summary: "Claim only succeeds when the reward window has advanced far enough for the current position.",
        operatorHint: "Use the address that owns the reward-bearing stake position for the selected validator.",
        nextStep: "If claim is blocked, inspect validator status, reward cursor progress, and finalized checkpoint movement first."
      };
  }
}

export function StakingConsoleCard(props: StakingConsoleCardProps) {
  const {
    initialFrom = "",
    suggestedNonce,
    currentSummary,
    currentValidator,
    currentStakes,
    currentCheckpoints,
    currentFinalized,
    onTrack,
    onActionChange,
    onSuccess
  } = props;
  const [form, setForm] = useState<FormState>({
    action: "validator_register",
    from: initialFrom,
    validatorAddress: "",
    amount: "",
    fee: "1",
    privateKey: "",
    pqPrivateKey: "",
    consensusPublicKey: "",
    nonce: suggestedNonce == null ? "" : String(suggestedNonce)
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<SendTxResponse | null>(null);
  const [validatorLookup, setValidatorLookup] = useState<ValidatorResponse | null>(null);
  const [validatorLookupLoading, setValidatorLookupLoading] = useState(false);
  const [validatorLookupError, setValidatorLookupError] = useState<ApiError | null>(null);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      from: initialFrom,
      nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
    }));
  }, [initialFrom, suggestedNonce]);

  useEffect(() => {
    onActionChange?.(form.action);
  }, [form.action, onActionChange]);

  const normalizedFrom = form.from.trim().toLowerCase();
  const normalizedValidatorAddress = form.validatorAddress.trim().toLowerCase();
  const preferredStakeValidatorAddress = currentStakes?.stakes[0]?.validator_address ?? "";
  const preferredValidatorAddress =
    currentValidator && currentValidator.found
      ? currentValidator.validator.validator_address
      : preferredStakeValidatorAddress || initialFrom;
  const normalizedPreferredValidatorAddress = preferredValidatorAddress.trim().toLowerCase();
  const bondedPositions = currentStakes?.stakes.filter((stake) => stake.status === "bonded") ?? [];
  const unbondingPositions = currentStakes?.stakes.filter((stake) => stake.status === "unbonding") ?? [];
  const latestCheckpointHeight =
    currentFinalized?.found === true
      ? currentFinalized.checkpoint_height
      : currentCheckpoints?.latest_checkpoint_height ?? null;
  const readyToFinalizePositions = unbondingPositions.filter(
    (stake) =>
      latestCheckpointHeight != null &&
      stake.unlock_requested_height != null &&
      latestCheckpointHeight >= stake.unlock_requested_height + 1
  );
  const activeValidator = currentValidator?.found ? currentValidator.validator.status === "active" : false;
  const pendingValidator = currentValidator?.found ? currentValidator.validator.status === "pending" : false;
  const inactiveValidator = currentValidator?.found ? currentValidator.validator.status === "inactive" : false;
  const hasAvailableBalance = currentSummary != null && Number(currentSummary.available) > 0;
  const hasPreferredValidator = normalizedPreferredValidatorAddress.length > 0;
  const rewardBearingStake = bondedPositions.find(
    (stake) => stake.validator_address.trim().toLowerCase() === normalizedPreferredValidatorAddress
  );
  const isSelfBondAttempt =
    form.action === "stake_bond" &&
    normalizedFrom.length > 0 &&
    normalizedValidatorAddress.length > 0 &&
    normalizedFrom === normalizedValidatorAddress;

  useEffect(() => {
    if (form.action !== "stake_bond" || !form.validatorAddress.trim() || !isLikelyAddress(form.validatorAddress.trim())) {
      setValidatorLookup(null);
      setValidatorLookupError(null);
      setValidatorLookupLoading(false);
      return;
    }

    let cancelled = false;
    setValidatorLookupLoading(true);
    void getValidator(form.validatorAddress.trim())
      .then((nextValidator) => {
        if (cancelled) {
          return;
        }
        setValidatorLookup(nextValidator);
        setValidatorLookupError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }
        setValidatorLookup(null);
        setValidatorLookupError(nextError as ApiError);
      })
      .finally(() => {
        if (!cancelled) {
          setValidatorLookupLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.action, form.validatorAddress]);

  const validatorBondHint = useMemo(() => {
    if (form.action !== "stake_bond" || !form.validatorAddress.trim() || !validatorLookup || !validatorLookup.found) {
      return null;
    }

    if (validatorLookup.validator.status === "pending") {
      return isSelfBondAttempt
        ? "This pending validator can enter active status only through a positive self-bond."
        : "This validator is still pending. Delegation will not activate it; the validator must self-bond first.";
    }

    if (validatorLookup.validator.status === "inactive") {
      return isSelfBondAttempt
        ? "This inactive validator may return through self-bond or self-rebond, but rewards still wait for new finalized progress."
        : "This validator is inactive. Delegation cannot reactivate it; only self-bond or self-rebond can bring it back.";
    }

    return "This validator is already active. Additional delegation should not reset its active window.";
  }, [form.action, form.validatorAddress, isSelfBondAttempt, validatorLookup]);

  const knownImpossibleBondAttempt =
    form.action === "stake_bond" &&
    validatorLookup?.found === true &&
    !isSelfBondAttempt &&
    (validatorLookup.validator.status === "pending" || validatorLookup.validator.status === "inactive");

  const bondModeLabel =
    form.action !== "stake_bond"
      ? null
      : !form.from.trim() || !form.validatorAddress.trim()
        ? "Set both From and Validator Address to determine whether this is self-bond or delegation."
        : isSelfBondAttempt
          ? "Bond mode: self-bond"
          : "Bond mode: delegation";

  const bondModeHint =
    form.action !== "stake_bond"
      ? null
      : !form.from.trim() || !form.validatorAddress.trim()
        ? "Self-bond means the validator operator is bonding to their own validator address. Delegation means a different address is bonding to that validator."
        : isSelfBondAttempt
          ? "This bond can activate a pending validator or reactivate an inactive one, but reward claim still waits for new finalized progress."
          : "This bond adds delegated stake only. It cannot activate a pending validator or reactivate an inactive one.";

  const lifecycleGuide =
    form.action === "validator_register"
      ? "Lifecycle: validator_register creates a pending validator record. The validator then needs a positive self-bond before it can become active."
      : form.action === "stake_bond" && validatorLookup?.found === true && validatorLookup.validator.status === "pending"
        ? isSelfBondAttempt
          ? "Lifecycle: this self-bond is the activation step for a pending validator. Third-party delegation must wait until the validator is active."
          : "Lifecycle: pending validators cannot be activated by delegation. Ask the validator operator to self-bond first."
        : form.action === "stake_bond" && validatorLookup?.found === true && validatorLookup.validator.status === "inactive"
          ? isSelfBondAttempt
            ? "Lifecycle: self-bond or self-rebond can reactivate this validator, but reward claim still waits for new finalized progress after reactivation."
            : "Lifecycle: inactive validators do not accept delegation as a shortcut back into the active set. Only self-bond or self-rebond can reactivate them."
          : null;

  const helperText = useMemo(() => {
    switch (form.action) {
      case "validator_register":
        return "Register writes the minimal validator record in pending status. A validator still needs a positive self-bond to become active.";
      case "stake_bond":
        return isSelfBondAttempt
          ? "Self-bond moves liquid balance into bonded stake and can activate a pending validator or reactivate an inactive one."
          : "Delegation bond moves liquid balance into bonded stake, but it cannot activate or reactivate a validator on its own.";
      case "stake_unbond":
        return "Unbond marks the bonded stake as unbonding and removes effective voting power.";
      case "stake_unbond_finalize":
        return "Finalize releases a mature unbonding position back into liquid balance after the checkpoint delay.";
      case "stake_reward_claim":
        return "Reward claim realizes accrued staking reward for the selected validator position.";
    }
  }, [form.action, isSelfBondAttempt]);

  const submitLabel = form.action === "stake_bond" ? "Submit Bond" : `Submit ${actionLabel(form.action)}`;
  const actionCopy = getActionProductCopy(form.action, isSelfBondAttempt);
  const showsValidatorAddress = form.action !== "validator_register";
  const showsConsensusKey = form.action === "validator_register";
  const showsBondAmount = form.action === "stake_bond";
  const showsPqKey = true;
  const recommendedTemplateLabel = readyToFinalizePositions.length > 0
    ? "Finalize Current Position"
    : pendingValidator || inactiveValidator
      ? "Self Bond"
      : !currentValidator?.found
        ? "Register Validator"
        : bondedPositions.length > 0
          ? "Claim Current Reward"
          : activeValidator
            ? "Use Current Validator"
            : "Register Validator";
  const recommendationReason = readyToFinalizePositions.length > 0
    ? `You already have ${readyToFinalizePositions.length} mature unbonding position${readyToFinalizePositions.length === 1 ? "" : "s"} ready for finalize.`
    : pendingValidator
      ? "This address already has a pending validator record, so the highest-value next step is a positive self-bond."
      : inactiveValidator
        ? "This validator is inactive, so self-bond is the path that can reactivate it."
        : !currentValidator?.found
          ? "No validator record is visible for this address yet, so registration is the cleanest starting point."
          : bondedPositions.length > 0
            ? "A bonded position already exists, so reward claim or lifecycle follow-up is the most likely next move."
            : "This address already has validator context, so starting from the current validator template will reduce manual input.";
  const readinessChecks = useMemo(() => {
    switch (form.action) {
      case "validator_register":
        return [
          "Use the operator address and key that should own the validator record.",
          "Registration alone does not activate the validator in the active set.",
          "Keep a self-bond plan ready for the next step."
        ];
      case "stake_bond":
        return [
          isSelfBondAttempt
            ? "Self-bond uses the same address in both From and Validator Address."
            : "Delegation uses your staker address in From and a different Validator Address as the target.",
          "Check validator status first. Pending or inactive validators cannot be activated by delegation alone.",
          "Use chain summary next_nonce if you need deterministic sequencing."
        ];
      case "stake_unbond":
        return [
          "Make sure the address in From currently owns a bonded stake position for this validator.",
          "Unbond changes stake lifecycle first; liquid balance returns only after finalize.",
          "Track finalized checkpoints after submission so you know when finalize becomes available."
        ];
      case "stake_unbond_finalize":
        return [
          "Confirm the stake position is already unbonding before submitting finalize.",
          "Finalize only succeeds after the required checkpoint delay has passed.",
          "Refresh stake positions and summary after success to verify the balance returned."
        ];
      case "stake_reward_claim":
        return [
          "Claim does not unlock rewards if the validator is inactive or reward progress is still gated.",
          "Check reward cursor progress and latest finalized progress first.",
          "Treat a claim failure as a lifecycle signal, not only as a form error."
        ];
    }
  }, [form.action, isSelfBondAttempt]);

  const quickTemplates = useMemo(
    (): QuickTemplate[] => [
      {
        key: "register",
        label: "Register Validator",
        note: currentValidator?.found
          ? `This address is already registered as ${currentValidator.validator.status}. Re-register only if you are intentionally rotating setup flow.`
          : "Start here when this operator address does not have a validator record yet.",
        emphasized: recommendedTemplateLabel === "Register Validator",
        action: () =>
          setForm((current) => ({
            ...current,
            action: "validator_register",
            from: initialFrom,
            validatorAddress: "",
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      },
      {
        key: "self-bond",
        label: "Self Bond",
        disabled: !initialFrom.trim() || !hasAvailableBalance,
        note: !initialFrom.trim()
          ? "Set a From address first so self-bond can target the operator address."
          : !hasAvailableBalance
            ? "No available balance is visible for this address yet."
            : pendingValidator
              ? "Recommended when you want to move a pending validator toward activation."
              : inactiveValidator
                ? "Recommended when you want to reactivate an inactive validator."
                : "Use this when the operator is bonding to their own validator address.",
        emphasized: recommendedTemplateLabel === "Self Bond",
        action: () =>
          setForm((current) => ({
            ...current,
            action: "stake_bond",
            from: initialFrom,
            validatorAddress: initialFrom || preferredValidatorAddress,
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      },
      {
        key: "current-validator",
        label: "Use Current Validator",
        disabled: !hasPreferredValidator,
        note: hasPreferredValidator
          ? "Preloads the best validator address visible in your current dashboard context."
          : "A current validator address is not available yet. Load validator or stake context first.",
        emphasized: recommendedTemplateLabel === "Use Current Validator",
        action: () =>
          setForm((current) => ({
            ...current,
            action: "stake_bond",
            from: initialFrom,
            validatorAddress: preferredValidatorAddress,
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      },
      {
        key: "unbond",
        label: "Unbond Current Position",
        disabled: bondedPositions.length === 0,
        note:
          bondedPositions.length === 0
            ? "No bonded stake position is visible for the selected address."
            : `You currently have ${bondedPositions.length} bonded position${bondedPositions.length === 1 ? "" : "s"} that can move into unbonding.`,
        emphasized: false,
        action: () =>
          setForm((current) => ({
            ...current,
            action: "stake_unbond",
            from: initialFrom,
            validatorAddress: preferredValidatorAddress,
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      },
      {
        key: "finalize",
        label: "Finalize Current Position",
        disabled: readyToFinalizePositions.length === 0,
        note:
          readyToFinalizePositions.length === 0
            ? "No mature unbonding position is ready to finalize yet."
            : `Recommended when you want to release ${readyToFinalizePositions.length} mature unbonding position${readyToFinalizePositions.length === 1 ? "" : "s"} back into liquid balance.`,
        emphasized: recommendedTemplateLabel === "Finalize Current Position",
        action: () =>
          setForm((current) => ({
            ...current,
            action: "stake_unbond_finalize",
            from: initialFrom,
            validatorAddress: preferredValidatorAddress,
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      },
      {
        key: "claim",
        label: "Claim Current Reward",
        disabled: !rewardBearingStake,
        note: rewardBearingStake
          ? "Use this when the selected validator position has progressed far enough for reward realization."
          : "No bonded position is visible for the current validator context yet.",
        emphasized: recommendedTemplateLabel === "Claim Current Reward",
        action: () =>
          setForm((current) => ({
            ...current,
            action: "stake_reward_claim",
            from: initialFrom,
            validatorAddress: preferredValidatorAddress,
            nonce: suggestedNonce == null ? current.nonce : String(suggestedNonce)
          }))
      }
    ],
    [
      bondedPositions.length,
      currentValidator,
      hasAvailableBalance,
      hasPreferredValidator,
      initialFrom,
      inactiveValidator,
      pendingValidator,
      preferredValidatorAddress,
      readyToFinalizePositions.length,
      recommendedTemplateLabel,
      rewardBearingStake,
      suggestedNonce
    ]
  );

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
    setError(null);
  }

  function validate(): ValidationErrors {
    const nextErrors: ValidationErrors = {};

    if (form.from.trim() && !isLikelyAddress(form.from.trim())) {
      nextErrors.from = "From address format is invalid.";
    }

    if (!form.privateKey.trim() || form.privateKey.trim().length < 16) {
      nextErrors.privateKey = "Private key is too short.";
    }

    if (form.fee.trim() && !isPositiveIntegerString(form.fee.trim())) {
      nextErrors.fee = "Fee must be a positive integer.";
    }

    if (form.nonce.trim() && (!/^\d+$/.test(form.nonce.trim()) || Number(form.nonce.trim()) < 0)) {
      nextErrors.nonce = "Nonce must be an integer greater than or equal to 0.";
    }

    if (
      (form.action === "stake_bond" ||
        form.action === "stake_unbond" ||
        form.action === "stake_unbond_finalize" ||
        form.action === "stake_reward_claim") &&
      !isLikelyAddress(form.validatorAddress.trim())
    ) {
      nextErrors.validatorAddress = "Validator address format is invalid.";
    }

    if (form.action === "stake_bond" && !isPositiveIntegerString(form.amount.trim())) {
      nextErrors.amount = "Bond amount must be a positive integer.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      return;
    }

    setSending(true);
    setError(null);

    try {
      const nonce = form.nonce.trim() ? Number(form.nonce.trim()) : undefined;
      const commonPayload = {
        from: form.from.trim() || undefined,
        privateKey: form.privateKey.trim(),
        pqPrivateKey: form.pqPrivateKey.trim() || undefined,
        fee: form.fee.trim() || undefined,
        nonce
      };

      const nextResult =
        form.action === "validator_register"
          ? await sendStakingTransaction("validator_register", {
              ...commonPayload,
              consensusPublicKey: form.consensusPublicKey.trim() || undefined
            })
          : form.action === "stake_bond"
            ? await sendStakingTransaction("stake_bond", {
                ...commonPayload,
                validatorAddress: form.validatorAddress.trim(),
                amount: form.amount.trim()
              })
            : form.action === "stake_unbond"
              ? await sendStakingTransaction("stake_unbond", {
                  ...commonPayload,
                  validatorAddress: form.validatorAddress.trim()
                })
              : form.action === "stake_unbond_finalize"
                ? await sendStakingTransaction("stake_unbond_finalize", {
                    ...commonPayload,
                    validatorAddress: form.validatorAddress.trim()
                  })
                : await sendStakingTransaction("stake_reward_claim", {
                    ...commonPayload,
                    validatorAddress: form.validatorAddress.trim()
                  });

      setResult(nextResult);
      setForm((current) => ({
        ...current,
        amount: form.action === "stake_bond" ? "" : current.amount,
        privateKey: "",
        pqPrivateKey: "",
        nonce: suggestedNonce == null ? "" : String(suggestedNonce)
      }));
      setValidationErrors({});
      onSuccess?.(nextResult, { action: form.action, from: commonPayload.from });
    } catch (nextError) {
      setError(nextError as ApiError);
    } finally {
      setSending(false);
    }
  }

  function handleAutoFillNonce() {
    if (suggestedNonce != null) {
      update("nonce", String(suggestedNonce));
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Staking Console</h2>
        <span className="muted">
          This is a compact staking action console for integration checks, not a full staking product flow.
        </span>
      </div>
      <div className="staking-template-bar">
        {quickTemplates.map((template) => (
          <article
            key={template.key}
            className={template.emphasized ? "staking-template-card staking-template-card-emphasis" : "staking-template-card"}
          >
            <button
              type="button"
              className="secondary staking-template-button"
              onClick={template.action}
              disabled={template.disabled}
            >
              {template.label}
            </button>
            <span className="muted">{template.note}</span>
          </article>
        ))}
      </div>
      <div className="staking-lifecycle-note">
        <strong>Recommended Next Template</strong>
        <span>
          {recommendedTemplateLabel}: {recommendationReason}
        </span>
      </div>
      <div className="staking-action-tabs">
        {([
          "validator_register",
          "stake_bond",
          "stake_unbond",
          "stake_unbond_finalize",
          "stake_reward_claim"
        ] as StakingAction[]).map((action) => (
          <button
            key={action}
            type="button"
            className={action === form.action ? "staking-action-tab active" : "staking-action-tab"}
            onClick={() => update("action", action)}
          >
            {actionLabel(action)}
          </button>
        ))}
      </div>
      <div className="grid two-col">
        <article className="stat-card accent">
          <span className="stat-label">Current Action</span>
          <strong>{actionCopy.title}</strong>
          <span className="muted">{actionCopy.summary}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Operator Hint</span>
          <strong>{actionCopy.operatorHint}</strong>
          <span className="muted">{actionCopy.nextStep}</span>
        </article>
      </div>
      <p className="muted staking-helper-text">{helperText}</p>
      {lifecycleGuide ? <div className="muted">{lifecycleGuide}</div> : null}
      {bondModeLabel ? (
        <div className="stat-card">
          <span className="stat-label">{bondModeLabel}</span>
          <strong>{bondModeHint}</strong>
        </div>
      ) : null}
      <div className="staking-checks">
        {readinessChecks.map((item) => (
          <div key={item} className="staking-check-item">
            {item}
          </div>
        ))}
      </div>
      <form className="stack gap-md" onSubmit={handleSubmit}>
        <div className="staking-form-section">
          <strong>Transaction Identity</strong>
          <span className="muted">Keys sign locally in this browser; only the signed staking transaction is submitted.</span>
        </div>
        <div className="grid two-col">
          <label className="field">
            <span>{form.action === "stake_bond" && !isSelfBondAttempt ? "Delegator Address (Optional)" : "From (Optional)"}</span>
            <input
              value={form.from}
              onChange={(event) => update("from", event.target.value)}
              placeholder="Operator or delegator address"
              autoComplete="off"
            />
            {validationErrors.from ? <small className="field-error">{validationErrors.from}</small> : null}
          </label>
          <label className="field">
            <span>Nonce (Optional)</span>
            <input
              inputMode="numeric"
              value={form.nonce}
              onChange={(event) => update("nonce", event.target.value)}
              placeholder={suggestedNonce == null ? "Leave empty to let the wallet choose" : `Suggested: ${suggestedNonce}`}
            />
            {validationErrors.nonce ? <small className="field-error">{validationErrors.nonce}</small> : null}
            {!validationErrors.nonce && suggestedNonce != null ? (
              <small className="muted">Use the latest chain summary nonce when you want deterministic sequencing.</small>
            ) : null}
          </label>
          <label className="field staking-wide-field">
            <span>Private Key</span>
            <textarea
              rows={4}
              value={form.privateKey}
              onChange={(event) => update("privateKey", event.target.value)}
              placeholder="Paste the signing private key only for this request"
              autoComplete="off"
              required
            />
            {validationErrors.privateKey ? (
              <small className="field-error">{validationErrors.privateKey}</small>
            ) : null}
            {!validationErrors.privateKey ? (
              <small className="muted">The private key is not sent to the wallet backend.</small>
            ) : null}
          </label>
        </div>

        <div className="staking-form-section">
          <strong>Action Parameters</strong>
          <span className="muted">Only the fields required for the current staking action are shown below.</span>
        </div>
        <div className="grid two-col">
          {showsValidatorAddress ? (
            <label className="field">
              <span>{form.action === "stake_bond" ? "Target Validator Address" : "Validator Address"}</span>
              <input
                value={form.validatorAddress}
                onChange={(event) => update("validatorAddress", event.target.value)}
                placeholder="0x..."
                autoComplete="off"
                required
              />
              {validationErrors.validatorAddress ? (
                <small className="field-error">{validationErrors.validatorAddress}</small>
              ) : null}
            </label>
          ) : null}

          {showsConsensusKey ? (
            <label className="field">
              <span>Consensus Public Key (Optional)</span>
              <input
                value={form.consensusPublicKey}
                onChange={(event) => update("consensusPublicKey", event.target.value)}
                placeholder="Optional for validator registration"
              />
            </label>
          ) : null}

          {showsBondAmount ? (
            <label className="field">
              <span>{isSelfBondAttempt ? "Self-Bond Amount" : "Delegation Amount"}</span>
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
                placeholder="Positive integer amount"
                required
              />
              {validationErrors.amount ? <small className="field-error">{validationErrors.amount}</small> : null}
            </label>
          ) : null}

          <label className="field">
            <span>Fee</span>
            <input
              inputMode="numeric"
              value={form.fee}
              onChange={(event) => update("fee", event.target.value)}
              placeholder="1"
            />
            {validationErrors.fee ? <small className="field-error">{validationErrors.fee}</small> : null}
          </label>

          {showsPqKey ? (
            <label className="field">
              <span>PQ Private Key (Optional)</span>
              <textarea
                rows={4}
                value={form.pqPrivateKey}
                onChange={(event) => update("pqPrivateKey", event.target.value)}
                placeholder="Only needed for hybrid/PQ authorization"
              />
              <small className="muted">The PQ private key also signs locally and is never submitted.</small>
            </label>
          ) : null}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={handleAutoFillNonce} disabled={suggestedNonce == null}>
            Auto Fill Next Nonce
          </button>
          <button type="submit" disabled={sending || knownImpossibleBondAttempt}>
            {sending ? "Sending..." : submitLabel}
          </button>
        </div>
        {form.action === "stake_bond" && validatorLookupLoading ? (
          <div className="muted">Checking validator lifecycle status...</div>
        ) : null}
        {form.action === "stake_bond" && validatorLookupError ? (
          <div className="error-banner">
            {validatorLookupError.code}: {validatorLookupError.message}
          </div>
        ) : null}
        {validatorBondHint ? <div className="muted">{validatorBondHint}</div> : null}
        {result ? (
          <div className="staking-lifecycle-note">
            <strong>What To Do Next</strong>
            <span>Latest staking action accepted by the wallet API. Open Tracker, wait for confirmation, then refresh validator or stake views to confirm the lifecycle change.</span>
          </div>
        ) : null}
        {error ? (
          <div className="error-banner">
            {error.code}: {error.message}
          </div>
        ) : null}
      </form>
      <SendResultCard result={result} onTrack={onTrack} />
    </section>
  );
}
