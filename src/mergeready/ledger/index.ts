// SPDX-License-Identifier: Apache-2.0
import { withResilience, makeDegradedResult, isDegradedResult } from "../../../src/resilience/index.js";
import type { UsageEvent, CostReceipt } from "./types.js";
import type { NemotronRole, ModelTier } from "../tokenfactory/types.js";
import type { DegradedResult } from "../../../src/resilience/index.js";

export interface LedgerClient {
  record(r: UsageEvent): Promise<void>;
  summary(traceId: string): Promise<CostReceipt | DegradedResult<CostReceipt>>;
  policyFor(role: NemotronRole, traceId?: string): Promise<ModelTier>;
}

const LEDGER_RESILIENCE = {
  timeout_ms: 4000,
  retries: 1,
  fallback_chain: { order: ["none"] },
} as const;

function sidecarBase(): string {
  const v = (process.env["MERGEREADY_SIDECAR_URL"] ?? "").trim();
  return v === "" ? "http://127.0.0.1:8787" : v;
}

export const ledgerClient: LedgerClient = {
  record: async (r: UsageEvent): Promise<void> => {
    try {
      const res = await fetch(sidecarBase() + "/cost/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(r),
      });
      if (!res.ok) console.warn("ledger record failed: HTTP " + res.status);
    } catch (err) {
      console.warn("ledger record failed: " + (err instanceof Error ? err.message : String(err)));
    }
  },
  summary: async (traceId: string): Promise<CostReceipt | DegradedResult<CostReceipt>> => {
    const zeroed: CostReceipt = {
      traceId,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      usd: 0,
      sandboxSeconds: 0,
      downgrades: [],
    };
    const out = await withResilience(async () => {
      const res = await fetch(sidecarBase() + "/cost/summary?trace_id=" + encodeURIComponent(traceId), {
        method: "GET",
      });
      if (!res.ok) throw new Error("summary HTTP " + res.status);
      return (await res.json()) as CostReceipt;
    }, LEDGER_RESILIENCE)();
    if (isDegradedResult(out)) {
      return makeDegradedResult<CostReceipt>({
        reason: out.reason,
        fallback_source: "none",
        original_error: out.original_error,
        data: zeroed,
      });
    }
    return out as CostReceipt;
  },
  policyFor: async (role: NemotronRole, traceId?: string): Promise<ModelTier> => {
    const defaults: Record<NemotronRole, ModelTier> = {
      planner: "ultra",
      redrafter: "ultra",
      drafter: "nano",
    };
    // The trace id is forwarded so the sidecar can attribute a downgrade
    // transition to this run's CostReceipt.downgrades[] (FR-09 surfacing).
    // Omitting it preserves the original C-14 (role)-only behaviour.
    const qs = "/cost/policy?role=" + encodeURIComponent(role) + (traceId ? "&trace_id=" + encodeURIComponent(traceId) : "");
    const out = await withResilience(async () => {
      const res = await fetch(sidecarBase() + qs, {
        method: "GET",
      });
      if (!res.ok) throw new Error("policy HTTP " + res.status);
      return (await res.json()) as { tier: ModelTier };
    }, LEDGER_RESILIENCE)();
    if (isDegradedResult(out)) return defaults[role];
    const tier = (out as { tier: unknown }).tier;
    if (tier === "ultra" || tier === "super" || tier === "nano") return tier;
    return defaults[role];
  },
};
