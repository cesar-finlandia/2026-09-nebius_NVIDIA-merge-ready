// SPDX-License-Identifier: Apache-2.0
import type { NemotronRole, ModelTier } from "../tokenfactory/types.js";

export interface UsageEvent {
  traceId: string;
  role: NemotronRole;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  sandboxSeconds?: number;
}

export interface DowngradeEntry {
  role: NemotronRole;
  from: ModelTier;
  to: ModelTier;
  reason: string;
}

export interface CostReceipt {
  traceId: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  usd: number;
  sandboxSeconds: number;
  downgrades: DowngradeEntry[];
}

export interface TierDecision {
  tier: ModelTier;
  hardStop: boolean;
  reason: string | null;
}
