// SPDX-License-Identifier: Apache-2.0
import { callNemotron } from "src/mergeready/tokenfactory/client.js";
import { resolveModelId } from "src/mergeready/tokenfactory/models.js";
import { renderPlanner, renderDrafter, renderRedrafter } from "src/mergeready/prompts/index.js";
import { parsePatchPlan, parseCandidateDiff } from "src/mergeready/prompts/schemas.js";
import type { PatchPlan, PlanStep, CandidateDiff } from "src/mergeready/prompts/schemas.js";
import { packPlannerInput, packDrafterInput } from "src/mergeready/context/pack.js";
import { groundTicket } from "src/mergeready/grounding/tavily.js";
import type { GroundingBundle } from "src/mergeready/grounding/tavily.js";
import { sandboxClient } from "src/mergeready/sandbox/index.js";
import { ledgerClient } from "src/mergeready/ledger/index.js";
import type { CostReceipt } from "src/mergeready/ledger/types.js";
import type { SandboxRunResult } from "src/mergeready/sandbox/types.js";
import { composePr } from "src/mergeready/pr/compose.js";
import type { PrProposal, AcceptedStep, RejectedStep } from "src/mergeready/pr/compose.js";
import { publishPr } from "src/mergeready/pr/publish.js";
import { readEnv } from "src/mergeready/api/env.js";
import { withResilience, isDegradedResult } from "src/resilience";
import type { ResilienceConfig } from "src/resilience";
import type { Ticket, RunArgs, RunResult } from "./types.js";
import type {
  IntakePayload,
  GroundingPayload,
  BaselinePayload,
  ContextPackPayload,
  PlanningPayload,
  DraftPayload,
  VerifyPayload,
  LedgerPayload,
  PrPayload,
} from "./payloads.js";
import { fallbackSingleStepPlan, nowIso, sha256Hex } from "./helpers.js";
import { draftStepId, verifyStepId, redraftStepId, reverifyStepId } from "./steps.js";
import { isMergeable } from "./gate.js";
import type { RepoSnapshot } from "src/mergeready/context/snapshot.js";
import type { Publisher } from "src/platform/transport";

void packDrafterInput;
void redraftStepId;
void reverifyStepId;

const RES_GROUND: ResilienceConfig = {
  timeout_ms: 15000,
  retries: 1,
  backoff: { policy: "exponential" },
  fallback_chain: { order: ["cache", "none"] },
};

const RES_SANDBOX: ResilienceConfig = {
  timeout_ms: 300000,
  retries: 0,
  backoff: { policy: "none" },
  fallback_chain: { order: ["none"] },
};

const RES_NEMOTRON: ResilienceConfig = {
  timeout_ms: 60000,
  retries: 2,
  backoff: { policy: "exponential" },
  fallback_chain: { order: ["secondary_provider", "cache", "none"] },
};

const RES_LEDGER: ResilienceConfig = {
  timeout_ms: 10000,
  retries: 1,
  backoff: { policy: "exponential" },
  fallback_chain: { order: ["cache", "none"] },
};

const RES_PR: ResilienceConfig = {
  timeout_ms: 15000,
  retries: 1,
  backoff: { policy: "exponential" },
  fallback_chain: { order: ["none"] },
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function fileTextFor(snapshot: RepoSnapshot, file: string): string {
  const f = snapshot.files.find((e) => e.path === file);
  return f ? f.text : "";
}

function salvageDiff(value: unknown): CandidateDiff {
  const d = value as { data?: unknown } | null;
  const data = d !== null && typeof d === "object" ? (d as { data?: unknown }).data : null;
  if (data !== null && typeof data === "object" && typeof (data as { unifiedDiff?: unknown }).unifiedDiff === "string") {
    return data as CandidateDiff;
  }
  throw new Error("draft-parse-failed");
}

interface VerifyOutcome {
  ok: boolean;
  branchTag: string;
  reason: string;
  run: SandboxRunResult | null;
}

async function verifyDiff(args: {
  cand: CandidateDiff;
  stepId: string;
  parentTag: string;
  snapshot: RepoSnapshot;
  traceId: string;
  publish: Publisher;
}): Promise<VerifyOutcome> {
  const { cand, stepId, parentTag, snapshot, traceId, publish } = args;
  await publish({ stepId, status: "started", payload: {}, traceId });
  const sha = sha256Hex(cand.unifiedDiff);
  const r = await withResilience(
    () =>
      sandboxClient.runBranch({
        traceId,
        stepId: cand.stepId,
        parentTag,
        file: cand.file,
        unifiedDiff: cand.unifiedDiff,
        testCommand: snapshot.testCommand,
        timeoutSeconds: 300,
      }),
    RES_SANDBOX,
  )();
  if (isDegradedResult(r)) {
    const vp: VerifyPayload = {
      stepId: cand.stepId,
      branchTag: "unknown",
      parentTag,
      exitCode: -1,
      verifiedSha: "",
      diffSha256: sha,
      gateOk: false,
      gateReason: "sandbox-degraded",
      rolledBack: false,
      durationMs: 0,
      stdout: "",
      stderr: "",
      degraded: true,
    };
    await publish({
      stepId,
      status: "error",
      payload: vp as unknown as Record<string, unknown>,
      traceId,
      degraded: true,
    });
    return { ok: false, branchTag: "unknown", reason: "sandbox-degraded", run: null };
  }
  const run = r as SandboxRunResult;
  const verdict = isMergeable(cand, run);
  const vp: VerifyPayload = {
    stepId: cand.stepId,
    branchTag: run.branchTag,
    parentTag: run.parentTag,
    exitCode: run.exitCode,
    verifiedSha: run.verifiedSha,
    diffSha256: sha,
    gateOk: verdict.ok,
    gateReason: verdict.reason,
    rolledBack: run.rolledBack,
    durationMs: run.durationMs,
    stdout: run.stdout,
    stderr: run.stderr,
    degraded: false,
  };
  await publish({
    stepId,
    status: "done",
    payload: vp as unknown as Record<string, unknown>,
    traceId,
  });
  return { ok: verdict.ok, branchTag: run.branchTag, reason: verdict.reason, run };
}

interface StepUsage {
  role: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
}

interface StepOutcome {
  accept: boolean;
  diff: CandidateDiff | null;
  run: SandboxRunResult | null;
  stepDegraded: boolean;
  usage: StepUsage[];
}

function asCount(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

async function runOneStep(args: {
  step: PlanStep;
  n: number;
  snapshot: RepoSnapshot;
  parentTag: string;
  packedText: string;
  contextWindow: number;
  traceId: string;
  publish: Publisher;
}): Promise<StepOutcome> {
  const { step: s, n, snapshot, parentTag, packedText, contextWindow, traceId, publish } = args;
  const sid = draftStepId(n);
  const vid = verifyStepId(n);
  const rsid = redraftStepId(n);
  const rvid = reverifyStepId(n);
  const fileText = fileTextFor(snapshot, s.file);
  let stepDegraded = false;
  const usage: StepUsage[] = [];
  await publish({ stepId: sid, status: "started", payload: {}, traceId });
  let cand: CandidateDiff;
  let modelId = "unknown";
  try {
    packDrafterInput({
      stepId: s.id,
      file: s.file,
      intent: s.intent,
      acceptance: s.acceptance,
      fileText,
      testFileText: null,
      testFilePath: null,
      contextWindow,
    });
  } catch { /* packing is best-effort; drafter still runs */ }
  const dr = renderDrafter({
    stepId: s.id,
    file: s.file,
    intent: s.intent,
    acceptance: s.acceptance,
    fileText,
    packedContext: packedText,
  });
  const d0 = await withResilience(
    () => callNemotron({ role: "drafter", system: dr.system, user: dr.user, traceId }),
    RES_NEMOTRON,
  )();
  if (isDegradedResult(d0)) {
    stepDegraded = true;
    try {
      cand = salvageDiff(d0);
    } catch {
      const dp: DraftPayload = {
        stepId: s.id,
        file: s.file,
        diffBytes: 0,
        diffSha256: "",
        modelId: "unknown",
        degraded: true,
      };
      await publish({
        stepId: sid,
        status: "error",
        payload: dp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
      return { accept: false, diff: null, run: null, stepDegraded: true, usage };
    }
  } else {
    const resp = d0 as { text: string; modelId: string; promptTokens?: unknown; completionTokens?: unknown };
    modelId = resp.modelId ?? "unknown";
    usage.push({
      role: "drafter",
      modelId,
      promptTokens: asCount(resp.promptTokens),
      completionTokens: asCount(resp.completionTokens),
    });
    try {
      const parsed = await parseCandidateDiff(resp.text);
      if (!parsed.ok) throw new Error("draft-parse-failed");
      cand = parsed.value;
    } catch {
      await publish({
        stepId: sid,
        status: "error",
        payload: { reason: "draft-parse-failed", stepId: s.id } as unknown as Record<string, unknown>,
        traceId,
      });
      return { accept: false, diff: null, run: null, stepDegraded, usage };
    }
  }
  const sha0 = sha256Hex(cand!.unifiedDiff);
  const dp0: DraftPayload = {
    stepId: s.id,
    file: cand!.file,
    diffBytes: cand!.unifiedDiff.length,
    diffSha256: sha0,
    modelId,
    degraded: stepDegraded,
  };
  await publish({
    stepId: sid,
    status: "done",
    payload: dp0 as unknown as Record<string, unknown>,
    traceId,
    degraded: stepDegraded ? true : undefined,
  });
  const v0 = await verifyDiff({ cand: cand!, stepId: vid, parentTag, snapshot, traceId, publish });
  if (v0.run && v0.ok) return { accept: true, diff: cand!, run: v0.run, stepDegraded: stepDegraded || false, usage };
  if (!v0.ok && v0.run === null) {
    const deg = true;
    return { accept: false, diff: cand!, run: null, stepDegraded: deg, usage };
  }
  try {
    await sandboxClient.rollback({ branchTag: v0.branchTag, parentTag });
  } catch { /* best effort */ }
  await publish({ stepId: rsid, status: "started", payload: {}, traceId });
  const rr = renderRedrafter({
    stepId: s.id,
    file: s.file,
    intent: s.intent,
    acceptance: s.acceptance,
    fileText,
    previousDiff: cand!.unifiedDiff,
    failingLog: v0.reason,
  });
  const d1 = await withResilience(
    () => callNemotron({ role: "redrafter", system: rr.system, user: rr.user, traceId }),
    RES_NEMOTRON,
  )();
  if (isDegradedResult(d1)) {
    const dp1: DraftPayload = {
      stepId: s.id,
      file: s.file,
      diffBytes: 0,
      diffSha256: "",
      modelId: "unknown",
      degraded: true,
    };
    await publish({
      stepId: rsid,
      status: "error",
      payload: dp1 as unknown as Record<string, unknown>,
      traceId,
      degraded: true,
    });
    return { accept: false, diff: cand!, run: v0.run, stepDegraded: true, usage };
  }
  const r1 = d1 as { text: string; modelId: string; promptTokens?: unknown; completionTokens?: unknown };
  usage.push({
    role: "redrafter",
    modelId: r1.modelId ?? "unknown",
    promptTokens: asCount(r1.promptTokens),
    completionTokens: asCount(r1.completionTokens),
  });
  let cand2: CandidateDiff;
  try {
    const parsed2 = await parseCandidateDiff(r1.text);
    if (!parsed2.ok) throw new Error("redraft-parse-failed");
    cand2 = parsed2.value;
  } catch {
    await publish({
      stepId: rsid,
      status: "error",
      payload: { reason: "redraft-parse-failed", stepId: s.id } as unknown as Record<string, unknown>,
      traceId,
    });
    return { accept: false, diff: cand!, run: v0.run, stepDegraded: true, usage };
  }
  const dp2: DraftPayload = {
    stepId: s.id,
    file: cand2!.file,
    diffBytes: cand2!.unifiedDiff.length,
    diffSha256: sha256Hex(cand2!.unifiedDiff),
    modelId: r1.modelId ?? "unknown",
    degraded: stepDegraded,
  };
  await publish({
    stepId: rsid,
    status: "done",
    payload: dp2 as unknown as Record<string, unknown>,
    traceId,
    degraded: stepDegraded ? true : undefined,
  });
  const v1 = await verifyDiff({ cand: cand2!, stepId: rvid, parentTag, snapshot, traceId, publish });
  if (v1.ok && v1.run) return { accept: true, diff: cand2!, run: v1.run, stepDegraded, usage };
  try {
    await sandboxClient.rollback({ branchTag: v1.branchTag, parentTag });
  } catch { /* best effort */ }
  return { accept: false, diff: cand2!, run: v1.run, stepDegraded: stepDegraded || v1.run === null, usage };
}

export async function runTicket(args: RunArgs): Promise<RunResult> {
  const { ticket, snapshot, traceId, publish } = args;
  const env = readEnv();
  const maxSteps = env.MERGEREADY_MAX_STEPS;
  let degraded = false;
  const emptyResult = (d: boolean): RunResult => ({
    traceId,
    accepted: [],
    rejected: [],
    proposal: null,
    receipt: null,
    degraded: d,
  });
  const contractMissing = async (stepId: string, err: unknown): Promise<never> => {
    try {
      await publish({
        stepId,
        status: "error",
        payload: { reason: "contract-missing:" + String(err) } as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } catch { /* ignore publish failure while reporting contract-missing */ }
    throw err;
  };
  const isContractMissing = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes("Cannot find module") || msg.includes("contract-missing");
  };
  // A1 step 2: intake started.
  try {
    const intakeStarted: IntakePayload = {
      ticketId: typeof ticket?.id === "string" ? ticket.id : "",
      title: typeof ticket?.title === "string" ? ticket.title : "",
      repoUrl: typeof ticket?.repoUrl === "string" ? ticket.repoUrl : "",
      branchBase: typeof ticket?.branchBase === "string" ? ticket.branchBase : "",
      traceId,
    };
    await publish({
      stepId: "intake",
      status: "started",
      payload: intakeStarted as unknown as Record<string, unknown>,
      traceId,
    });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  // A1 step 3: validate ticket.
  if (
    !isNonEmptyString(ticket?.id) ||
    !isNonEmptyString(ticket?.title) ||
    !isNonEmptyString(ticket?.body) ||
    !isNonEmptyString(ticket?.repoUrl) ||
    !isNonEmptyString(ticket?.branchBase)
  ) {
    degraded = true;
    try {
      await publish({
        stepId: "intake",
        status: "error",
        payload: { reason: "invalid-ticket", traceId } as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } catch { /* ignore */ }
    return emptyResult(true);
  }
  // A1 step 4: intake done.
  try {
    const intakeDone: IntakePayload = {
      ticketId: ticket.id,
      title: ticket.title,
      repoUrl: ticket.repoUrl,
      branchBase: ticket.branchBase,
      traceId,
    };
    await publish({
      stepId: "intake",
      status: "done",
      payload: intakeDone as unknown as Record<string, unknown>,
      traceId,
    });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  // A1 steps 5-6: grounding with RES_GROUND degrade-to-empty-bundle.
  let grounding!: GroundingBundle;
  try {
    await publish({ stepId: "grounding", status: "started", payload: {}, traceId });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  try {
    const g = await withResilience(() => groundTicket(ticket), RES_GROUND)();
    if (isDegradedResult(g)) {
      degraded = true;
      grounding = { query: ticket.title, results: [], fetchedAt: nowIso(), provider: "tavily" };
      const gp: GroundingPayload = {
        query: grounding.query,
        resultCount: 0,
        results: [],
        citationsInPrompt: [],
        provider: "tavily",
        fetchedAt: grounding.fetchedAt,
        degraded: true,
      };
      await publish({
        stepId: "grounding",
        status: "done",
        payload: gp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } else {
      grounding = g as GroundingBundle;
      const gp: GroundingPayload = {
        query: grounding.query,
        resultCount: grounding.results.length,
        results: grounding.results.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet })),
        citationsInPrompt: grounding.results.slice(0, 3).map((r) => r.url),
        provider: "tavily",
        fetchedAt: grounding.fetchedAt,
        degraded: false,
      };
      await publish({
        stepId: "grounding",
        status: "done",
        payload: gp as unknown as Record<string, unknown>,
        traceId,
      });
    }
  } catch (err) {
    if (isContractMissing(err)) await contractMissing("grounding", err);
    degraded = true;
    grounding = { query: ticket.title, results: [], fetchedAt: nowIso(), provider: "tavily" };
    try {
      const gp: GroundingPayload = {
        query: grounding.query,
        resultCount: 0,
        results: [],
        citationsInPrompt: [],
        provider: "tavily",
        fetchedAt: grounding.fetchedAt,
        degraded: true,
      };
      await publish({
        stepId: "grounding",
        status: "error",
        payload: gp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } catch { /* ignore */ }
  }
  // A1 steps 7-8: baseline with RES_SANDBOX.
  let parentTag = "baseline:failed";
  try {
    await publish({ stepId: "baseline", status: "started", payload: {}, traceId });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  try {
    const b = await withResilience(
      () =>
        sandboxClient.createBaseline({
          traceId,
          repoSnapshot: {
            root: snapshot.root,
            files: snapshot.files.map((f) => ({ path: f.path, bytes: f.bytes, text: f.text })),
            testCommand: snapshot.testCommand,
            baseImage: snapshot.baseImage,
          },
        }),
      RES_SANDBOX,
    )();
    if (isDegradedResult(b)) {
      degraded = true;
      parentTag = "baseline:failed";
      const bp: BaselinePayload = { tag: parentTag, imageId: "unknown", degraded: true };
      await publish({
        stepId: "baseline",
        status: "error",
        payload: bp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } else {
      const cp = b as { tag: string; imageId: string };
      parentTag = cp.tag;
      const bp: BaselinePayload = { tag: cp.tag, imageId: cp.imageId, degraded: false };
      await publish({
        stepId: "baseline",
        status: "done",
        payload: bp as unknown as Record<string, unknown>,
        traceId,
      });
    }
  } catch (err) {
    if (isContractMissing(err)) await contractMissing("baseline", err);
    degraded = true;
    parentTag = "baseline:failed";
    try {
      const bp: BaselinePayload = { tag: parentTag, imageId: "unknown", degraded: true };
      await publish({
        stepId: "baseline",
        status: "error",
        payload: bp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } catch { /* ignore */ }
  }
  void parentTag;
  // A1 steps 9-10: context-pack via resolveModelId planner + packPlannerInput.
  let packedText = "";
  let packedTokens = 0;
  let packedDropped: string[] = [];
  let packedStrategy = "sliding-window-pinned";
  let contextWindow = 128000;
  try {
    await publish({ stepId: "context-pack", status: "started", payload: {}, traceId });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  try {
    const m = await resolveModelId("planner");
    contextWindow = m.contextWindow;
    const packed = packPlannerInput({ ticket, grounding, snapshot, contextWindow });
    packedText = packed.text;
    packedTokens = packed.tokens;
    packedDropped = packed.droppedFiles;
    packedStrategy = packed.strategy;
    const cpp: ContextPackPayload = {
      tokens: packed.tokens,
      droppedFiles: packed.droppedFiles,
      strategy: packed.strategy,
      contextWindow,
    };
    await publish({
      stepId: "context-pack",
      status: "done",
      payload: cpp as unknown as Record<string, unknown>,
      traceId,
    });
  } catch (err) {
    if (isContractMissing(err)) await contractMissing("context-pack", err);
    throw err;
  }
  // A1 steps 11-14: planning via renderPlanner + callNemotron role planner
  // + parsePatchPlan with fallbackSingleStepPlan on throw, truncate to maxSteps.
  // Per-role model/token attribution for the receipt (FR-08): accumulated
  // from every successful Token Factory call; first non-unknown model wins.
  const usageByRole = new Map<string, { modelId: string; promptTokens: number; completionTokens: number }>();
  function recordUsage(role: string, modelId: string, promptTokens: number, completionTokens: number): void {
    const prev = usageByRole.get(role);
    if (!prev) {
      usageByRole.set(role, { modelId, promptTokens, completionTokens });
      return;
    }
    usageByRole.set(role, {
      modelId: prev.modelId !== "unknown" && prev.modelId !== "" ? prev.modelId : modelId,
      promptTokens: prev.promptTokens + promptTokens,
      completionTokens: prev.completionTokens + completionTokens,
    });
  }
  let plan: PatchPlan;
  let planModelId = "";
  try {
    await publish({ stepId: "planning", status: "started", payload: {}, traceId });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  try {
    const pr = renderPlanner({
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      ticketBody: ticket.body,
      packedContext: packedText,
      styleGuide: "",
      maxSteps,
    });
    const resp = await withResilience(
      () => callNemotron({ role: "planner", system: pr.system, user: pr.user, traceId }),
      RES_NEMOTRON,
    )();
    if (isDegradedResult(resp)) {
      degraded = true;
      plan = fallbackSingleStepPlan(ticket);
      try {
        const m = await resolveModelId("planner");
        planModelId = m.modelId;
      } catch {
        planModelId = "unknown";
      }
    } else {
      const r = resp as { text: string; modelId: string; promptTokens?: unknown; completionTokens?: unknown };
      planModelId = r.modelId;
      recordUsage("planner", planModelId, asCount(r.promptTokens), asCount(r.completionTokens));
      try {
        const parsed = await parsePatchPlan(r.text);
        if (!parsed.ok) throw new Error("patch-plan-invalid");
        plan = parsed.value;
      } catch {
        degraded = true;
        plan = fallbackSingleStepPlan(ticket);
      }
    }
  } catch (err) {
    if (isContractMissing(err)) await contractMissing("planning", err);
    degraded = true;
    plan = fallbackSingleStepPlan(ticket);
  }
  // A1 step 13: truncate to maxSteps.
  if (plan!.steps.length > maxSteps) {
    plan!.steps = plan!.steps.slice(0, maxSteps);
  }
  // A1 step 14: publish planning done.
  try {
    const pp: PlanningPayload = {
      summary: plan!.summary,
      stepCount: plan!.steps.length,
      stepIds: plan!.steps.map((s) => s.id),
      modelId: planModelId,
      degraded,
    };
    await publish({
      stepId: "planning",
      status: "done",
      payload: pp as unknown as Record<string, unknown>,
      traceId,
      degraded: degraded ? true : undefined,
    });
  } catch (err) {
    if (isContractMissing(err)) throw err;
  }
  void packedTokens;
  void packedDropped;
  void packedStrategy;
  // A1 steps 15-21: per-step loop, ledger, PR, never-throw (W5).
  const accepted: PlanStep[] = [];
  const rejected: PlanStep[] = [];
  const diffs: CandidateDiff[] = [];
  const logs: string[] = [];
  // DP-PR C-21 inputs: per-step entries with run objects for composePr.
  const acceptedEntries: AcceptedStep[] = [];
  const rejectedEntries: RejectedStep[] = [];
  const allRuns: SandboxRunResult[] = [];
  let receipt: CostReceipt | null = null;
  let proposal: PrProposal | null = null;
  let currentStepId = "planning";
  const runBudget = (env as unknown as { MERGEREADY_RUN_BUDGET_USD?: unknown }).MERGEREADY_RUN_BUDGET_USD;
  const budgetCap = typeof runBudget === "number" ? runBudget : 0.75;
  const prModeRaw = (env as unknown as { MERGEREADY_PR_MODE?: unknown }).MERGEREADY_PR_MODE;
  const prMode: "dry" | "live" = prModeRaw === "live" ? "live" : "dry";
  async function budgetExceeded(): Promise<boolean> {
    try {
      const s = await ledgerClient.summary(traceId);
      if (isDegradedResult(s)) return false;
      const r = s as CostReceipt;
      return typeof r.usd === "number" && r.usd > budgetCap;
    } catch {
      return false;
    }
  }
  async function doLedger(): Promise<void> {
    currentStepId = "ledger";
    await publish({ stepId: "ledger", status: "started", payload: {}, traceId });
    try {
      const s = await withResilience(() => ledgerClient.summary(traceId), RES_LEDGER)();
      if (isDegradedResult(s)) {
        degraded = true;
        receipt = null;
        const lp: LedgerPayload = {
          calls: 0,
          promptTokens: 0,
          completionTokens: 0,
          usd: 0,
          sandboxSeconds: 0,
          runBudgetUsd: env.MERGEREADY_RUN_BUDGET_USD,
          downgrades: [],
          degraded: true,
        };
        await publish({
          stepId: "ledger",
          status: "error",
          payload: lp as unknown as Record<string, unknown>,
          traceId,
          degraded: true,
        });
      } else {
        receipt = s as CostReceipt;
        const lp: LedgerPayload = {
          calls: receipt.calls,
          promptTokens: receipt.promptTokens,
          completionTokens: receipt.completionTokens,
          usd: receipt.usd,
          sandboxSeconds: receipt.sandboxSeconds,
          runBudgetUsd: env.MERGEREADY_RUN_BUDGET_USD,
          downgrades: (receipt.downgrades ?? []).map((d) => ({
            role: String((d as { role?: unknown }).role ?? ""),
            from: String((d as { from?: unknown }).from ?? ""),
            to: String((d as { to?: unknown }).to ?? ""),
            reason: String((d as { reason?: unknown }).reason ?? ""),
          })),
          degraded: false,
        };
        await publish({
          stepId: "ledger",
          status: "done",
          payload: lp as unknown as Record<string, unknown>,
          traceId,
        });
      }
    } catch (err) {
      if (isContractMissing(err)) await contractMissing("ledger", err);
      degraded = true;
      receipt = null;
      const lp: LedgerPayload = {
        calls: 0,
        promptTokens: 0,
        completionTokens: 0,
        usd: 0,
        sandboxSeconds: 0,
        runBudgetUsd: env.MERGEREADY_RUN_BUDGET_USD,
        downgrades: [],
        degraded: true,
      };
      await publish({
        stepId: "ledger",
        status: "error",
        payload: lp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    }
  }
  async function doPr(): Promise<void> {
    currentStepId = "pr";
    await publish({ stepId: "pr", status: "started", payload: {}, traceId });
    try {
      const modelByRole: Record<string, string> = {};
      const tokensByRole: Record<string, { promptTokens: number; completionTokens: number }> = {};
      for (const [role, u] of usageByRole) {
        modelByRole[role] = u.modelId;
        tokensByRole[role] = { promptTokens: u.promptTokens, completionTokens: u.completionTokens };
      }
      if (planModelId !== "" && modelByRole["planner"] === undefined) modelByRole["planner"] = planModelId;
      const composed = (composePr as unknown as (a: unknown) => PrProposal)({
        ticket,
        plan,
        accepted: acceptedEntries,
        rejected: rejectedEntries,
        runs: allRuns,
        grounding: (typeof grounding === "undefined" ? null : grounding) as GroundingBundle | null,
        receipt,
        traceId,
        modelByRole,
        tokensByRole,
      });
      proposal = composed;
      const pub = await withResilience(() => publishPr(proposal as PrProposal, prMode), RES_PR)();
      if (isDegradedResult(pub)) {
        degraded = true;
        if (proposal) proposal.url = null;
      } else {
        const u = (pub as { url?: unknown }).url;
        if (proposal) proposal.url = typeof u === "string" ? (u as string) : (u as null);
      }
      const pp: PrPayload = {
        title: proposal ? proposal.title : ticket.title,
        body: proposal ? proposal.body : "",
        branch: proposal ? proposal.branch : "unknown",
        unifiedDiff: proposal ? proposal.unifiedDiff : "",
        receiptMarkdown: proposal ? proposal.receiptMarkdown : "",
        url: proposal ? proposal.url : null,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        mode: prMode,
        degraded,
      };
      await publish({
        stepId: "pr",
        status: "done",
        payload: pp as unknown as Record<string, unknown>,
        traceId,
        degraded: degraded ? true : undefined,
      });
    } catch (err) {
      if (isContractMissing(err)) await contractMissing("pr", err);
      degraded = true;
      if (proposal) proposal.url = null;
      const pp: PrPayload = {
        title: proposal ? proposal.title : ticket.title,
        body: proposal ? proposal.body : "",
        branch: proposal ? proposal.branch : "unknown",
        unifiedDiff: proposal ? proposal.unifiedDiff : "",
        receiptMarkdown: proposal ? proposal.receiptMarkdown : "",
        url: proposal ? proposal.url : null,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
        mode: prMode,
        degraded: true,
      };
      await publish({
        stepId: "pr",
        status: "done",
        payload: pp as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    }
  }
  try {
    for (let i = 0; i < plan!.steps.length; i++) {
      const s = plan!.steps[i] as PlanStep;
      currentStepId = draftStepId(i);
      if (await budgetExceeded()) {
        degraded = true;
        for (let j = i; j < plan!.steps.length; j++) {
          rejected.push(plan!.steps[j] as PlanStep);
          rejectedEntries.push({ step: plan!.steps[j] as PlanStep, diff: null, run: null, reason: "budget-exhausted" });
        }
        try {
          await publish({
            stepId: currentStepId,
            status: "error",
            payload: { reason: "budget-exhausted", stepId: s.id } as unknown as Record<string, unknown>,
            traceId,
            degraded: true,
          });
        } catch { /* ignore */ }
        break;
      }
      try {
        const out = await runOneStep({
          step: s,
          n: i,
          snapshot,
          parentTag,
          packedText,
          contextWindow,
          traceId,
          publish,
        });
        if (out.stepDegraded) degraded = true;
        for (const u of out.usage) recordUsage(u.role, u.modelId, u.promptTokens, u.completionTokens);
        if (out.accept && out.diff && out.run) {
          accepted.push(s);
          diffs.push(out.diff);
          logs.push(out.run.stdout + "\n" + out.run.stderr);
          acceptedEntries.push({ step: s, diff: out.diff, run: out.run });
          allRuns.push(out.run);
        } else {
          rejected.push(s);
          if (out.diff) diffs.push(out.diff);
          if (out.run) logs.push(out.run.stdout + "\n" + out.run.stderr);
          else logs.push(out.stepDegraded ? "draft-degraded" : "rejected:" + s.id);
          rejectedEntries.push({
            step: s,
            diff: out.diff ?? null,
            run: out.run ?? null,
            reason: out.run ? `exit-code:${out.run.exitCode}` : out.stepDegraded ? "draft-degraded" : "rejected:" + s.id,
          });
          if (out.run) allRuns.push(out.run);
        }
      } catch (err) {
        if (isContractMissing(err)) await contractMissing(currentStepId, err);
        degraded = true;
        rejected.push(s);
        rejectedEntries.push({ step: s, diff: null, run: null, reason: String(err instanceof Error ? err.message : err).slice(0, 200) });
        try {
          await publish({
            stepId: currentStepId,
            status: "error",
            payload: { reason: String(err instanceof Error ? err.message : err) } as unknown as Record<string, unknown>,
            traceId,
            degraded: true,
          });
        } catch { /* ignore */ }
      }
    }
    await doLedger();
    await doPr();
    return { traceId, accepted, rejected, proposal, receipt, degraded };
  } catch (err) {
    if (isContractMissing(err)) await contractMissing(currentStepId, err);
    degraded = true;
    try {
      await publish({
        stepId: currentStepId,
        status: "error",
        payload: { reason: String(err instanceof Error ? err.message : err) } as unknown as Record<string, unknown>,
        traceId,
        degraded: true,
      });
    } catch { /* ignore */ }
    try {
      await doLedger();
      await doPr();
    } catch { /* never throw */ }
    return { traceId, accepted, rejected, proposal, receipt, degraded: true };
  }
}
