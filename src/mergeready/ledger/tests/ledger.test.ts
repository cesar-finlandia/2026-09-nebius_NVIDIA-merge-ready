// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { decideTier } from "../policy.js";
import { ledgerClient } from "../index.js";

const base = { runBudgetUsd: 0.75, windowBudgetUsd: 50, currentTier: "ultra" } as const;

describe("ledger downgrade ladder", () => {
  it("mirrors A5.1 thresholds plus client surface", () => {
    expect(decideTier({ role: "planner", runUsd: 0, windowUsd: 0, ...base }).tier).toBe("ultra");
    const trig = decideTier({ role: "planner", runUsd: 0.5, windowUsd: 1.0, ...base });
    expect(trig.tier).toBe("super");
    expect(trig.reason).toBe("run>=60% of MERGEREADY_RUN_BUDGET_USD or window>=70% of MERGEREADY_BUDGET_USD");
    const high = decideTier({ role: "planner", runUsd: 0.7, windowUsd: 1.0, ...base });
    expect(high.tier).toBe("nano");
    expect(high.reason).toBe("run>=90% of MERGEREADY_RUN_BUDGET_USD or window>=90% of MERGEREADY_BUDGET_USD");
    const stop = decideTier({ role: "planner", runUsd: 0, windowUsd: 50, ...base });
    expect(stop.tier).toBe("nano");
    expect(stop.hardStop).toBe(true);
    expect(stop.reason).toBe("window budget exhausted: windowUsd >= MERGEREADY_BUDGET_USD");
    expect(decideTier({ role: "drafter", runUsd: 99, windowUsd: 99, ...base }).tier).toBe("nano");
    expect(decideTier({ role: "drafter", runUsd: 0, windowUsd: 0, ...base }).tier).toBe("nano");
    expect(typeof ledgerClient.record).toBe("function");
    expect(typeof ledgerClient.summary).toBe("function");
    expect(typeof ledgerClient.policyFor).toBe("function");
  });
});
