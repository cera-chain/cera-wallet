import type { ForkChoiceStatus } from "../types/api";

export type ForkChoiceDiagnosticCode =
  | "promoted_recently"
  | "blocked_by_finalized_lock"
  | "promotable_candidate_waiting"
  | "candidate_replay_failed"
  | "side_branch_not_advancing"
  | "no_side_branch"
  | "stable";

export type ForkChoiceDiagnosticModel = {
  code: ForkChoiceDiagnosticCode;
  title: string;
  summary: string;
  details: string[];
  tone: "idle" | "info" | "warning" | "success";
};

export function buildForkChoiceDiagnostic(status: ForkChoiceStatus | null): ForkChoiceDiagnosticModel | null {
  if (!status) {
    return null;
  }

  if (status.last_promotion_result_kind === "promoted" && status.last_promotion_reason_code === "promoted") {
    return {
      code: "promoted_recently",
      title: "Recent Promotion Succeeded",
      summary: "Recent guarded promotion completed successfully.",
      details: [
        `successes=${status.promotion_successes}`,
        `candidate_height=${formatNullable(status.last_promotion_candidate_height)}`
      ],
      tone: "success"
    };
  }

  if (
    status.advancing_side_branch_tips > 0 &&
    status.compatible_advancing_tips === 0 &&
    status.finalized_lock_filtered_tips > 0
  ) {
    return {
      code: "blocked_by_finalized_lock",
      title: "Candidates Blocked By Finalized Lock",
      summary: "Higher candidates exist, but all are blocked by the finalized checkpoint lock.",
      details: [
        `advancing=${status.advancing_side_branch_tips}`,
        `filtered=${status.finalized_lock_filtered_tips}`
      ],
      tone: "warning"
    };
  }

  if (status.last_promotion_reason_code === "replay_failed") {
    return {
      code: "candidate_replay_failed",
      title: "Candidate Replay Failed",
      summary: "The latest promotion attempt was rejected during replay validation.",
      details: [
        `attempts=${status.promotion_attempts}`,
        `candidate_height=${formatNullable(status.last_promotion_candidate_height)}`
      ],
      tone: "warning"
    };
  }

  if (status.compatible_advancing_tips > 0 && status.last_promotion_result_kind === "skipped") {
    return {
      code: "promotable_candidate_waiting",
      title: "Promotable Candidate Exists",
      summary: "A compatible candidate exists, but the latest promotion attempt did not complete.",
      details: [
        `reason=${formatNullable(status.last_promotion_reason_code)}`,
        `best_candidate_height=${formatNullable(status.readiness_best_candidate_height)}`
      ],
      tone: "warning"
    };
  }

  if (status.side_branch_tips > 0 && status.advancing_side_branch_tips === 0) {
    return {
      code: "side_branch_not_advancing",
      title: "Side Branch Present But Not Advancing",
      summary: "A side branch exists, but no candidate is above the canonical tip height.",
      details: [
        `side_branch_tips=${status.side_branch_tips}`,
        `tip_height=${status.tip_height}`
      ],
      tone: "info"
    };
  }

  if (status.side_branch_tips === 0) {
    return {
      code: "no_side_branch",
      title: "No Side Branch Detected",
      summary: "There is currently no observable side-branch candidate.",
      details: [
        `tip_height=${status.tip_height}`,
        `attempts=${status.promotion_attempts}`
      ],
      tone: "idle"
    };
  }

  return {
    code: "stable",
    title: "Fork-Choice Snapshot Stable",
    summary: "No high-priority fork-choice issue is currently exposed by this snapshot.",
    details: [
      `compatible=${status.compatible_advancing_tips}`,
      `last_result=${formatNullable(status.last_promotion_result_kind)}`
    ],
    tone: "info"
  };
}

function formatNullable(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "none";
  }
  return String(value);
}
