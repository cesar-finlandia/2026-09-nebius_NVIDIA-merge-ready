// SPDX-License-Identifier: Apache-2.0
export const STEP_IDS = [
  "intake",
  "grounding",
  "baseline",
  "context-pack",
  "planning",
  "ledger",
  "pr",
] as const;
export type FixedStepId = (typeof STEP_IDS)[number];
export type StepId = FixedStepId | `draft-${number}` | `verify-${number}` | `redraft-${number}` | `reverify-${number}`;
export function draftStepId(n: number): `draft-${number}` { return `draft-${n}`; }
export function verifyStepId(n: number): `verify-${number}` { return `verify-${n}`; }
export function redraftStepId(n: number): `redraft-${number}` { return `redraft-${n}`; }
export function reverifyStepId(n: number): `reverify-${number}` { return `reverify-${n}`; }
