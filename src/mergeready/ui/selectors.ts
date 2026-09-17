// SPDX-License-Identifier: Apache-2.0
// Pure derivations over transport envelopes. No React, no fetch, no clock.
import { STEP_IDS, draftStepId, verifyStepId, redraftStepId, reverifyStepId } from "src/mergeready/orchestrator/steps.js";
import type { DraftPayload, GroundingPayload, IntakePayload, LedgerPayload, PlanningPayload, PrPayload, VerifyPayload } from "src/mergeready/orchestrator/payloads.js";
import type { EventEnvelope } from "src/platform/transport";
import { degradedResultOf, isDegradedEnvelope } from "src/platform/ui";

export type Verdict = "pass" | "fail" | "rolled-back" | "unverified";

export interface MatrixRow {
  stepId: string;
  file: string;
  branchTag: string;
  parentTag: string;
  exitCode: number | null;
  durationMs: number | null;
  rolledBack: boolean;
  verifiedSha8: string;
  attempt: 1 | 2;
  verdict: Verdict;
  degraded: boolean;
  stdoutTail: string[];
}

export interface PlanStepView {
  id: string;
  file: string;
  intent: string;
  acceptance: string;
  verdict: Verdict;
}

export interface PlanningTraceView {
  summary: string;
  steps: PlanStepView[];
  degraded: boolean;
}

export interface PrView {
  title: string;
  body: string;
  branch: string;
  unifiedDiff: string;
  receiptMarkdown: string;
  url: string | null;
  mode: "dry" | "live";
  degraded: boolean;
}

export interface LedgerView {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  usd: number;
  sandboxSeconds: number;
  downgrades: { role: string; from: string; to: string; reason: string }[];
  overBudget: boolean;
  degraded: boolean;
}

export interface GroundingView {
  query: string;
  results: { title: string; url: string; snippet: string }[];
  degraded: boolean;
}

export interface RunHeaderView {
  ticketTitle: string;
  branchBase: string;
  traceId: string;
  mode: "live" | "replay";
  plannerModelId: string;
  verdict: Verdict | null;
  degraded: boolean;
}

export interface ActivityLine {
  stepId: string;
  text: string;
  done: boolean;
}

export interface DegradedReason {
  stepId: string;
  fallbackSource: string;
  detail: string;
}

// Fixed vocabulary comes from the orchestrator contract by position; the
// per-attempt families contribute their runtime prefixes. No literal step
// strings appear anywhere else in this file.
const FIXED = {
  first: STEP_IDS[0] as string,
  second: STEP_IDS[1] as string,
  third: STEP_IDS[2] as string,
  fourth: STEP_IDS[3] as string,
  fifth: STEP_IDS[4] as string,
  sixth: STEP_IDS[5] as string,
  seventh: STEP_IDS[6] as string,
};

const FIRST_ATTEMPT_PREFIX = draftStepId(0).replace(/0$/, "");
const FIRST_RUN_PREFIX = verifyStepId(0).replace(/0$/, "");
const SECOND_ATTEMPT_PREFIX = redraftStepId(0).replace(/0$/, "");
const SECOND_RUN_PREFIX = reverifyStepId(0).replace(/0$/, "");

const RUN_BUDGET_USD = 0.75;
const MISSING = "—";

function inScope(e: EventEnvelope, traceId: string | undefined): boolean {
  return !traceId || e.trace_id === traceId;
}

function scoped(envelopes: EventEnvelope[], traceId: string | undefined): EventEnvelope[] {
  return envelopes.filter((e) => inScope(e, traceId));
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseSuffixed(stepId: string, prefix: string): number | null {
  if (!stepId.startsWith(prefix)) return null;
  const rest = stepId.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  return Number.parseInt(rest, 10);
}

function lastMatch(list: EventEnvelope[], pred: (e: EventEnvelope) => boolean): EventEnvelope | null {
  let found: EventEnvelope | null = null;
  for (const e of list) {
    if (pred(e)) found = e;
  }
  return found;
}

function verdictOf(envelope: EventEnvelope, exitCode: number | null, rolledBack: boolean): Verdict {
  if (isDegradedEnvelope(envelope)) return "unverified";
  if (exitCode === null || exitCode === -1) return "unverified";
  if (rolledBack) return "rolled-back";
  if (exitCode === 0) return "pass";
  return "fail";
}

// Target file per authored unit, joined from the attempt envelopes that
// carry a DraftPayload for that unit id.
function fileByUnitId(list: EventEnvelope[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of list) {
    const isAttempt =
      parseSuffixed(e.step_id, SECOND_ATTEMPT_PREFIX) !== null ||
      parseSuffixed(e.step_id, FIRST_ATTEMPT_PREFIX) !== null;
    if (!isAttempt) continue;
    const p = e.payload as Partial<DraftPayload>;
    if (typeof p.stepId === "string" && typeof p.file === "string" && p.file !== "") {
      map.set(p.stepId, p.file);
    }
  }
  return map;
}

// Outcome for one authored unit position: the highest recorded run wins.
function verdictForPosition(list: EventEnvelope[], position: number): Verdict {
  let best: { attempt: number; envelope: EventEnvelope; payload: Partial<VerifyPayload> } | null = null;
  for (const e of list) {
    const second = parseSuffixed(e.step_id, SECOND_RUN_PREFIX);
    const first = second === null ? parseSuffixed(e.step_id, FIRST_RUN_PREFIX) : null;
    if (second === null && first === null) continue;
    if (e.status !== "done" && e.status !== "error") continue;
    if ((second ?? first) !== position) continue;
    const attempt = second === null ? 1 : 2;
    if (best === null || attempt > best.attempt) {
      best = { attempt, envelope: e, payload: e.payload as Partial<VerifyPayload> };
    }
  }
  if (!best) return "unverified";
  const exitCode = typeof best.payload.exitCode === "number" ? best.payload.exitCode : null;
  return verdictOf(best.envelope, exitCode, best.payload.rolledBack === true);
}

export function buildMatrixRows(envelopes: EventEnvelope[], traceId?: string): MatrixRow[] {
  const list = scoped(envelopes, traceId);
  const files = fileByUnitId(list);
  const withIndex: (MatrixRow & { index: number })[] = [];
  for (const e of list) {
    const second = parseSuffixed(e.step_id, SECOND_RUN_PREFIX);
    const first = second === null ? parseSuffixed(e.step_id, FIRST_RUN_PREFIX) : null;
    if (second === null && first === null) continue;
    if (e.status !== "done" && e.status !== "error") continue;
    const index = (second ?? first) as number;
    const p = e.payload as Partial<VerifyPayload>;
    const exitCode = typeof p.exitCode === "number" ? p.exitCode : null;
    const unitId = typeof p.stepId === "string" ? p.stepId : "";
    const stdout = asString(p.stdout, "");
    const stderr = asString(p.stderr, "");
    const combined = stdout + "\n" + stderr;
    const sha = asString(p.verifiedSha, "");
    withIndex.push({
      index,
      stepId: e.step_id,
      file: unitId !== "" && files.has(unitId) ? (files.get(unitId) as string) : MISSING,
      branchTag: asString(p.branchTag, ""),
      parentTag: asString(p.parentTag, ""),
      exitCode,
      durationMs: typeof p.durationMs === "number" ? p.durationMs : null,
      rolledBack: p.rolledBack === true,
      verifiedSha8: sha.length >= 8 ? sha.slice(0, 8) : MISSING,
      attempt: (second === null ? 1 : 2) as 1 | 2,
      verdict: verdictOf(e, exitCode, p.rolledBack === true),
      degraded: isDegradedEnvelope(e),
      stdoutTail: combined.trim() === "" ? [] : combined.split("\n").slice(-20),
    });
  }
  withIndex.sort((a, b) => a.index - b.index || a.attempt - b.attempt);
  return withIndex.map((row) => {
    const { index, branchTag, parentTag, ...rest } = row;
    void index;
    return {
      ...rest,
      branchTag: branchTag !== "" ? branchTag : MISSING,
      parentTag: parentTag !== "" ? parentTag : MISSING,
    };
  });
}

export function selectActivityLine(
  newestEnvelope: EventEnvelope | null | undefined,
  totalSteps: number,
): ActivityLine {
  if (!newestEnvelope) {
    return { stepId: "", text: "Starting the run — connecting to the event stream", done: false };
  }
  const id = newestEnvelope.step_id;
  const total = Number.isFinite(totalSteps) ? totalSteps : 0;
  let text: string;
  if (id === FIXED.first) {
    text = "Reading the ticket";
  } else if (id === FIXED.second) {
    text = "Searching for context";
  } else if (id === FIXED.third) {
    text = "Taking the baseline checkpoint";
  } else if (id === FIXED.fourth) {
    text = "Packing the repository for the planner";
  } else if (id === FIXED.fifth) {
    text = "Planning the patch";
  } else if (id === FIXED.sixth) {
    text = "Totting up the bill";
  } else if (id === FIXED.seventh) {
    text = "Composing the pull request";
  } else {
    const retryAttempt = parseSuffixed(id, SECOND_ATTEMPT_PREFIX);
    const firstAttempt = retryAttempt === null ? parseSuffixed(id, FIRST_ATTEMPT_PREFIX) : null;
    const retryRun = parseSuffixed(id, SECOND_RUN_PREFIX);
    const firstRun = retryRun === null ? parseSuffixed(id, FIRST_RUN_PREFIX) : null;
    if (retryAttempt !== null) {
      text = "Re-drafting step " + retryAttempt + " after a red build";
    } else if (firstAttempt !== null) {
      text = "Drafting step " + firstAttempt + " of " + total;
    } else if (retryRun !== null) {
      text = "Re-running the tests on branch " + retryRun;
    } else if (firstRun !== null) {
      text = "Running the test suite on branch " + firstRun;
    } else {
      text = id;
    }
  }
  const terminal =
    (id === FIXED.sixth || id === FIXED.seventh) &&
    (newestEnvelope.status === "done" || newestEnvelope.status === "error");
  return { stepId: id, text, done: terminal };
}

export function selectDegraded(envelopes: EventEnvelope[], traceId?: string): DegradedReason[] {
  const list = scoped(envelopes, traceId);
  const out: DegradedReason[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (!isDegradedEnvelope(e)) continue;
    if (seen.has(e.step_id)) continue;
    const result = degradedResultOf(e);
    if (!result) continue;
    seen.add(e.step_id);
    out.push({ stepId: e.step_id, fallbackSource: result.fallback_source, detail: result.reason });
  }
  return out;
}

export function selectGrounding(envelopes: EventEnvelope[], traceId?: string): GroundingView | null {
  const found = lastMatch(scoped(envelopes, traceId), (e) => e.step_id === FIXED.second);
  if (!found) return null;
  const p = found.payload as Partial<GroundingPayload>;
  const results: GroundingView["results"] = [];
  if (Array.isArray(p.results)) {
    for (const r of p.results) {
      const row = r as Partial<GroundingView["results"][number]>;
      if (typeof row.title !== "string" || row.title === "") continue;
      results.push({
        title: row.title,
        url: asString(row.url, ""),
        snippet: asString(row.snippet, ""),
      });
    }
  }
  return {
    query: asString(p.query, ""),
    results,
    degraded: isDegradedEnvelope(found) || p.degraded === true,
  };
}

export function selectPlanning(envelopes: EventEnvelope[], traceId?: string): PlanningTraceView | null {
  const list = scoped(envelopes, traceId);
  const found = lastMatch(list, (e) => e.step_id === FIXED.fifth && e.status === "done");
  if (!found) return null;
  const p = found.payload as Partial<PlanningPayload>;
  const ids = Array.isArray(p.stepIds)
    ? (p.stepIds as unknown[]).filter((s): s is string => typeof s === "string")
    : [];
  const files = fileByUnitId(list);
  return {
    summary: asString(p.summary, ""),
    steps: ids.map((id, position) => ({
      id,
      file: files.get(id) ?? MISSING,
      intent: MISSING,
      acceptance: MISSING,
      verdict: verdictForPosition(list, position),
    })),
    degraded: isDegradedEnvelope(found) || p.degraded === true,
  };
}

export function selectLedger(envelopes: EventEnvelope[], traceId?: string): LedgerView | null {
  const found = lastMatch(scoped(envelopes, traceId), (e) => e.step_id === FIXED.sixth);
  if (!found) return null;
  const p = found.payload as Partial<LedgerPayload>;
  const downgrades: LedgerView["downgrades"] = [];
  if (Array.isArray(p.downgrades)) {
    for (const d of p.downgrades) {
      const row = d as Partial<LedgerView["downgrades"][number]>;
      downgrades.push({
        role: asString(row.role, ""),
        from: asString(row.from, ""),
        to: asString(row.to, ""),
        reason: asString(row.reason, ""),
      });
    }
  }
  const usd = asNumber(p.usd, 0);
  // Over-budget compares against the run budget the server ran with (carried
  // on the envelope), falling back to the default when absent.
  const runBudget = asNumber((p as { runBudgetUsd?: unknown }).runBudgetUsd, RUN_BUDGET_USD);
  return {
    calls: asNumber(p.calls, 0),
    promptTokens: asNumber(p.promptTokens, 0),
    completionTokens: asNumber(p.completionTokens, 0),
    usd,
    sandboxSeconds: asNumber(p.sandboxSeconds, 0),
    downgrades,
    overBudget: usd > runBudget,
    degraded: isDegradedEnvelope(found) || p.degraded === true,
  };
}

export function selectPr(envelopes: EventEnvelope[], traceId?: string): PrView | null {
  const found = lastMatch(scoped(envelopes, traceId), (e) => e.step_id === FIXED.seventh);
  if (!found) return null;
  const p = found.payload as Partial<PrPayload>;
  return {
    title: asString(p.title, ""),
    body: asString(p.body, ""),
    branch: asString(p.branch, ""),
    unifiedDiff: asString(p.unifiedDiff, ""),
    receiptMarkdown: asString(p.receiptMarkdown, ""),
    url: typeof p.url === "string" ? p.url : null,
    acceptedCount: asNumber(p.acceptedCount, 0),
    rejectedCount: asNumber(p.rejectedCount, 0),
    mode: p.mode === "live" ? "live" : "dry",
    degraded: isDegradedEnvelope(found) || p.degraded === true,
  };
}

export function selectRunHeader(envelopes: EventEnvelope[], traceId?: string): RunHeaderView | null {
  const list = scoped(envelopes, traceId);
  if (list.length === 0) return null;
  const intake = lastMatch(list, (e) => e.step_id === FIXED.first);
  const planning = lastMatch(list, (e) => e.step_id === FIXED.fifth && e.status === "done");
  const pr = lastMatch(list, (e) => e.step_id === FIXED.seventh);
  const intakePayload = (intake ? intake.payload : {}) as Partial<IntakePayload>;
  const planningPayload = (planning ? planning.payload : {}) as Partial<PlanningPayload>;
  const prPayload = (pr ? pr.payload : {}) as Partial<PrPayload>;
  const acceptedCount = asNumber(prPayload.acceptedCount, 0);
  const rejectedCount = asNumber(prPayload.rejectedCount, 0);
  const last = list[list.length - 1] as EventEnvelope;
  const fallbackTrace = typeof last.trace_id === "string" ? last.trace_id : "";
  const intakeTrace = asString(intakePayload.traceId, "");
  return {
    ticketTitle: asString(intakePayload.title, ""),
    branchBase: asString(intakePayload.branchBase, ""),
    traceId: traceId ?? (intakeTrace !== "" ? intakeTrace : fallbackTrace),
    mode: prPayload.mode === "live" ? "live" : "replay",
    plannerModelId: asString(planningPayload.modelId, ""),
    verdict: pr && acceptedCount > 0 ? "pass" : pr && rejectedCount > 0 ? "fail" : null,
    degraded: list.some((e) => isDegradedEnvelope(e)),
  };
}
