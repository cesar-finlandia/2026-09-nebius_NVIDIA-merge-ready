// SPDX-License-Identifier: Apache-2.0
import type { PatchPlan } from "../prompts/schemas.js";
import type { Ticket } from "../orchestrator/types.js";
import type { SandboxRunResult } from "../sandbox/types.js";
import type { GroundingBundle } from "../grounding/tavily.js";
import { receiptLine } from "../grounding/citations.js";
import type { AcceptedStep, RejectedStep } from "./compose.js";

export interface BuildPrBodyArgs {
  ticket: Ticket;
  plan: PatchPlan;
  accepted: AcceptedStep[];
  rejected: RejectedStep[];
  runs: SandboxRunResult[];
  grounding: GroundingBundle | null;
  receiptMarkdown: string;
  conflicts: string[];
}

function truncateSnippet(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) : s;
}

export function buildPrBody(a: BuildPrBodyArgs): string {
  const acceptedIds = new Map(a.accepted.map((e) => [e.step.id, e]));
  const rejectedById = new Map(a.rejected.map((e) => [e.step.id, e]));
  const planRows = a.plan.steps.map((s) => {
    if (acceptedIds.has(s.id)) return `| ${s.id} | ${s.file} | ${s.intent} | accepted | — |`;
    const rej = rejectedById.get(s.id);
    const reason = rej ? rej.reason : "rejected";
    return `| ${s.id} | ${s.file} | ${s.intent} | rejected | ${reason} |`;
  });
  const verifyRows = a.runs.map(
    (r) => `| ${r.branchTag} | ${r.parentTag} | ${r.exitCode} | ${r.durationMs} | ${r.rolledBack} | ${r.verifiedSha.slice(0, 12)} |`,
  );
  let rejectedLogs: string;
  const rejectedWithRun = a.rejected.filter((e) => e.run !== null);
  if (rejectedWithRun.length === 0) {
    rejectedLogs = "All branches green — no failure logs.";
  } else {
    rejectedLogs = rejectedWithRun
      .map((e) => {
        const run = e.run as SandboxRunResult;
        const combined = (run.stdout + "\n" + run.stderr).split("\n").slice(0, 20).join("\n").slice(0, 2000);
        return `<details><summary>${run.branchTag} log (exit ${run.exitCode})</summary>\n\n\`\`\`\n${combined}\n\`\`\`\n</details>`;
      })
      .join("\n\n");
  }
  let groundingLines: string;
  if (a.grounding === null) {
    groundingLines = "No grounding citations — planner ran without Tavily context.";
  } else {
    const header = `Query: ${a.grounding.query} (tavily, ${a.grounding.fetchedAt})`;
    const lines = a.grounding.results.map(
      (r) => `- [${r.title}](${r.url}) — ${truncateSnippet(r.snippet, 160)}`,
    );
    groundingLines = [header, ...lines].join("\n");
  }
  // DP-GROUND A5.7 bonus proof: receipt carries the line naming exactly the
  // citations that entered the planner prompt (first up-to-3 URLs).
  const groundingReceipt =
    a.grounding === null ? "" : `\n${receiptLine(a.grounding)}\n`;
  let planSection = `## Plan\n${a.plan.summary}\n\n| step | file | intent | status | reason |\n|---|---|---|---|---|\n${planRows.join("\n")}`;
  if (a.conflicts.length > 0) {
    planSection += `\n> Diff conflicts: ${a.conflicts.join(" ")}`;
  }
  return (
    `## Ticket\n` +
    `- id: ${a.ticket.id}\n` +
    `- title: ${a.ticket.title}\n` +
    `- link: ${a.ticket.repoUrl} @ \`${a.ticket.branchBase}\`\n` +
    `\n` +
    `${planSection}\n` +
    `\n` +
    `## Verification\n` +
    `| branch | parent | exit | duration_ms | rolled_back | sha |\n` +
    `|---|---|---|---|---|---|\n` +
    `${verifyRows.join("\n")}\n` +
    `\n` +
    `${rejectedLogs}\n` +
    `\n` +
    `## Grounding\n` +
    `${groundingLines}\n` +
    `\n` +
    `## Receipt\n` +
    `${a.receiptMarkdown}${groundingReceipt}\n` +
    `---\n` +
    `Planned with Nemotron 3 Ultra and drafted with Nemotron 3 Nano via Nebius Token Factory; every diff executed in Nebius Token Factory Sandboxes with rollback on red builds.\n`
  );
}
