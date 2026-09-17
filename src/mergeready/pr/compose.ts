// SPDX-License-Identifier: Apache-2.0
import type { PatchPlan, CandidateDiff, PlanStep } from "../prompts/schemas.js";
import type { Ticket } from "../orchestrator/types.js";
import type { SandboxRunResult } from "../sandbox/types.js";
import type { CostReceipt } from "../ledger/types.js";
import type { GroundingBundle } from "../grounding/tavily.js";
import { renderReceiptMarkdown } from "./receipt.js";
import { buildPrBody } from "./body.js";

export interface ComposePrInput {
  ticket: Ticket;
  plan: PatchPlan;
  accepted: AcceptedStep[];
  rejected: RejectedStep[];
  runs: SandboxRunResult[];
  grounding: GroundingBundle | null;
  receipt: CostReceipt | null;
  traceId: string;
  modelByRole: Record<string, string>;
  tokensByRole: Record<string, { promptTokens: number; completionTokens: number }>;
}

export interface AcceptedStep {
  step: PlanStep;
  diff: CandidateDiff;
  run: SandboxRunResult;
}

export interface RejectedStep {
  step: PlanStep;
  diff: CandidateDiff | null;
  run: SandboxRunResult | null;
  reason: string;
}

export interface PrProposal {
  title: string;
  body: string;
  branch: string;
  unifiedDiff: string;
  receiptMarkdown: string;
  url: string | null;
}

export type ComposePrFn = (input: ComposePrInput) => PrProposal;

export function sanitizeTicketId(id: string): string {
  const dashed = id.replace(/[^A-Za-z0-9-]/g, "-").replace(/-+/g, "-");
  const trimmed = dashed.replace(/^-+/, "").replace(/-+$/, "").toLowerCase().slice(0, 40);
  return trimmed === "" ? "ticket" : trimmed;
}

export function sanitizeTraceSuffix(traceId: string): string {
  const raw = traceId.slice(0, 8).replace(/[^A-Za-z0-9]/g, "0");
  return raw.padEnd(8, "0");
}

function truncateTitle(title: string): string {
  return title.length > 80 ? title.slice(0, 80) + "..." : title;
}

export const composePr: ComposePrFn = (input) => {
  const order = new Map(input.plan.steps.map((s, i) => [s.id, i]));
  const sorted = [...input.accepted].sort((a, b) => {
    const ia = order.has(a.step.id) ? (order.get(a.step.id) as number) : Number.MAX_SAFE_INTEGER;
    const ib = order.has(b.step.id) ? (order.get(b.step.id) as number) : Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
  const parts = new Map<string, string>();
  const conflicts: string[] = [];
  for (const entry of sorted) {
    const f = entry.diff.file;
    if (parts.has(f)) {
      conflicts.push(`Conflict: step ${entry.step.id} also touches ${f}; kept later diff, dropped earlier diff for ${f}.`);
      parts.delete(f);
    }
    parts.set(f, entry.diff.unifiedDiff.trim() + "\n");
  }
  const unifiedDiff = sorted.length === 0 ? "" : [...parts.values()].join("\n");
  const branch = `mergeready/${sanitizeTicketId(input.ticket.id)}-${sanitizeTraceSuffix(input.traceId)}`;
  const title = `${truncateTitle(input.ticket.title)} (Merge-Ready, ${sorted.length}/${input.plan.steps.length} steps verified)`;
  const receiptBase = renderReceiptMarkdown(input.receipt, input.modelByRole, input.tokensByRole);
  // E2E completeness (FR-08/uc04): the receipt drawer shows the cost receipt
  // alone, so carry the patch plan and one line per branch with its test
  // result inside it, reusing the same row data as the PR body sections.
  const acceptedIds = new Set(sorted.map((e) => e.step.id));
  const planRows = input.plan.steps.map(
    (s) => `| ${s.id} | ${s.file} | ${s.intent} | ${acceptedIds.has(s.id) ? "accepted" : "rejected"} |`,
  );
  const branchRows = input.runs.map(
    (r) => `| ${r.branchTag} | ${r.exitCode} | ${r.durationMs} | ${r.rolledBack} | ${r.verifiedSha.slice(0, 12)} |`,
  );
  const receiptMarkdown =
    receiptBase +
    `\n## Plan\n${input.plan.summary}\n\n| step | file | intent | status |\n|---|---|---|---|\n${planRows.join("\n")}\n` +
    `\n## Verification\n| branch | exit | duration_ms | rolled_back | sha |\n|---|---|---|---|---|\n${branchRows.length > 0 ? branchRows.join("\n") : "No branches ran."}\n`;
  const body = buildPrBody({
    ticket: input.ticket,
    plan: input.plan,
    accepted: sorted,
    rejected: input.rejected,
    runs: input.runs,
    grounding: input.grounding,
    receiptMarkdown,
    conflicts,
  });
  return { title, body, branch, unifiedDiff, receiptMarkdown, url: null };
};
