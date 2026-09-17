// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
import type { Ticket } from "./types.js";
import type { PatchPlan } from "src/mergeready/prompts/schemas.js";

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function fallbackSingleStepPlan(ticket: Ticket): PatchPlan {
  return {
    summary: "fallback: single step",
    steps: [
      {
        id: "s1",
        file: "fallback.txt",
        intent: ticket.title.slice(0, 120),
        acceptance: "sandbox test command exits 0",
      },
    ],
  };
}
