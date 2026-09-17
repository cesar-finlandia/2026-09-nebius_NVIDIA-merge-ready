// SPDX-License-Identifier: Apache-2.0
export type NemotronRole = "planner" | "drafter" | "redrafter";
export type ModelTier = "ultra" | "super" | "nano";
export type ModelSource = "discovered" | "pinned" | "fallback";
export interface ResolvedModel {
  modelId: string;
  contextWindow: number;
  source: ModelSource;
}
export interface RoleTierDefaults {
  planner: ModelTier;
  drafter: ModelTier;
  redrafter: ModelTier;
}
