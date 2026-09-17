import { withResilience, makeDegradedResult } from "src/resilience";
import type { DegradedResult } from "src/resilience";
import type { Checkpoint, SandboxRunResult, BaselineArgs, BranchArgs } from "./types.js";
import type { CandidateDiff } from "src/mergeready/prompts/schemas.js";

const SANDBOX_RESILIENCE = {
  timeout_ms: 420000,
  retries: 0,
  fallback_chain: { order: ["none"] },
};

async function postJson(path: string, body: unknown): Promise<any> {
  const base = process.env.MERGEREADY_SIDECAR_URL ?? "http://127.0.0.1:8787";
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as unknown;
}

function toDegraded<T>(message: string) {
  return makeDegradedResult<T>({ reason: message, fallback_source: "none", original_error: message });
}

function hasErrorKey(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "error" in (value as Record<string, unknown>)) {
    const err = (value as Record<string, unknown>)["error"] as Record<string, unknown>;
    const msg = typeof err?.["message"] === "string" ? (err["message"] as string) : JSON.stringify(err ?? value);
    return msg;
  }
  return null;
}

export async function createBaseline(args: BaselineArgs): Promise<Checkpoint | DegradedResult<Checkpoint>> {
  const out = await withResilience(async () => {
    try {
      return await postJson("/sandbox/baseline", args);
    } catch (err) {
      return toDegraded<Checkpoint>(err instanceof Error ? err.message : String(err));
    }
  }, SANDBOX_RESILIENCE)();
  const msg = hasErrorKey(out);
  if (msg !== null) return toDegraded<Checkpoint>(msg);
  return out as Checkpoint | DegradedResult<Checkpoint>;
}

/** runBranch applies a CandidateDiff (stepId/file/unifiedDiff) as a sandbox branch. */
export async function runBranch(args: BranchArgs): Promise<SandboxRunResult | DegradedResult<SandboxRunResult>> {
  const out = await withResilience(async () => {
    try {
      return await postJson("/sandbox/branch", args);
    } catch (err) {
      return toDegraded<SandboxRunResult>(err instanceof Error ? err.message : String(err));
    }
  }, SANDBOX_RESILIENCE)();
  const msg = hasErrorKey(out);
  if (msg !== null) return toDegraded<SandboxRunResult>(msg);
  return out as SandboxRunResult | DegradedResult<SandboxRunResult>;
}

export async function rollback(args: { branchTag: string; parentTag: string }): Promise<Checkpoint | DegradedResult<Checkpoint>> {
  const out = await withResilience(async () => {
    try {
      return await postJson("/sandbox/rollback", args);
    } catch (err) {
      return toDegraded<Checkpoint>(err instanceof Error ? err.message : String(err));
    }
  }, SANDBOX_RESILIENCE)();
  const msg = hasErrorKey(out);
  if (msg !== null) return toDegraded<Checkpoint>(msg);
  return out as Checkpoint | DegradedResult<Checkpoint>;
}

export const sandboxClient = { createBaseline, runBranch, rollback };

// CandidateDiff shape reference for signature documentation (see runBranch).
type _CandidateDoc = CandidateDiff;
