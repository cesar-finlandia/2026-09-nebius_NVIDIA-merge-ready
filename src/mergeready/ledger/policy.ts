// SPDX-License-Identifier: Apache-2.0
import type { NemotronRole, ModelTier } from "../tokenfactory/types.js";
import type { TierDecision } from "./types.js";

export type { TierDecision } from "./types.js";

export interface DecideTierArgs {
  role: NemotronRole;
  runUsd: number;
  windowUsd: number;
  runBudgetUsd: number;
  windowBudgetUsd: number;
  currentTier: ModelTier;
}

export function decideTier(a: DecideTierArgs): TierDecision {
  const { role, runUsd, windowUsd, runBudgetUsd, windowBudgetUsd } = a;
  if (
    typeof runUsd !== "number" ||
    typeof windowUsd !== "number" ||
    typeof runBudgetUsd !== "number" ||
    typeof windowBudgetUsd !== "number" ||
    !Number.isFinite(runUsd) ||
    !Number.isFinite(windowUsd) ||
    !Number.isFinite(runBudgetUsd) ||
    !Number.isFinite(windowBudgetUsd)
  ) {
    return { tier: "nano", hardStop: false, reason: "invalid spend input" };
  }
  if (role === "drafter") {
    return { tier: "nano", hardStop: false, reason: null };
  }
  if (windowUsd >= windowBudgetUsd) {
    return {
      tier: "nano",
      hardStop: true,
      reason: "window budget exhausted: windowUsd >= MERGEREADY_BUDGET_USD",
    };
  }
  if (runUsd >= 0.9 * runBudgetUsd || windowUsd >= 0.9 * windowBudgetUsd) {
    return {
      tier: "nano",
      hardStop: false,
      reason:
        "run>=90% of MERGEREADY_RUN_BUDGET_USD or window>=90% of MERGEREADY_BUDGET_USD",
    };
  }
  if (runUsd >= 0.6 * runBudgetUsd || windowUsd >= 0.7 * windowBudgetUsd) {
    return {
      tier: "super",
      hardStop: false,
      reason:
        "run>=60% of MERGEREADY_RUN_BUDGET_USD or window>=70% of MERGEREADY_BUDGET_USD",
    };
  }
  return { tier: "ultra", hardStop: false, reason: null };
}
