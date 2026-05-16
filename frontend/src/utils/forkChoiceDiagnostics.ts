import type { ForkChoiceStatus } from "../types/api";

export type ForkChoiceDiagnostic = {
  title: string;
  summary: string;
  details: string[];
  tone: "idle" | "info" | "warning" | "success";
};

export function diagnoseForkChoice(status: ForkChoiceStatus | null): ForkChoiceDiagnostic | null {
  if (!status) {
    return null;
  }

  if (status.last_promotion_result_kind === "promoted" && status.last_promotion_reason_code === "promoted") {
    return {
      title: "Recent Promotion Succeeded",
      summary: "最近一次 guarded promotion 已成功完成。",
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
      title: "Candidates Blocked By Finalized Lock",
      summary: "当前存在更高候选，但都被 finalized checkpoint lock 拦下。",
      details: [
        `advancing=${status.advancing_side_branch_tips}`,
        `filtered=${status.finalized_lock_filtered_tips}`
      ],
      tone: "warning"
    };
  }

  if (status.compatible_advancing_tips > 0 && status.last_promotion_result_kind === "skipped") {
    return {
      title: "Promotable Candidate Exists",
      summary: "当前已有兼容候选，但最近一次 promotion 没有成功落地。",
      details: [
        `reason=${formatNullable(status.last_promotion_reason_code)}`,
        `best_candidate_height=${formatNullable(status.readiness_best_candidate_height)}`
      ],
      tone: "warning"
    };
  }

  if (status.last_promotion_reason_code === "replay_failed") {
    return {
      title: "Candidate Replay Failed",
      summary: "最近一次 promotion 被拦在 replay 验证阶段。",
      details: [
        `attempts=${status.promotion_attempts}`,
        `candidate_height=${formatNullable(status.last_promotion_candidate_height)}`
      ],
      tone: "warning"
    };
  }

  if (status.side_branch_tips > 0 && status.advancing_side_branch_tips === 0) {
    return {
      title: "Side Branch Present But Not Advancing",
      summary: "当前有 side-branch，但没有任何候选高度超过主链 tip。",
      details: [
        `side_branch_tips=${status.side_branch_tips}`,
        `tip_height=${status.tip_height}`
      ],
      tone: "info"
    };
  }

  if (status.side_branch_tips === 0) {
    return {
      title: "No Side Branch Detected",
      summary: "当前没有可观察到的 side-branch 候选。",
      details: [
        `tip_height=${status.tip_height}`,
        `attempts=${status.promotion_attempts}`
      ],
      tone: "idle"
    };
  }

  return {
    title: "Fork-Choice Snapshot Stable",
    summary: "当前 fork-choice 状态没有暴露出需要优先处理的异常组合。",
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
