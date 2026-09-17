// DP-PROMPTS W2 — Engine I/O types (C-06). Section 4 verbatim.
import { readFileSync } from "node:fs";
import { callNemotron } from "src/mergeready/tokenfactory/client.js";
import {
  isDegradedResult,
  renderRepairPrompt,
  validate,
} from "src/resilience";
import type { ValidationError } from "src/resilience";
export interface PlanStep {
  id: string;
  file: string;
  intent: string;
  acceptance: string;
}
export interface PatchPlan {
  summary: string;
  steps: PlanStep[];
}
export interface CandidateDiff {
  stepId: string;
  file: string;
  unifiedDiff: string;
  rationale: string;
}
export interface PlannerInput {
  ticketId: string;
  ticketTitle: string;
  ticketBody: string;
  packedContext: string;
  styleGuide: string;
  maxSteps: number;
}
export interface DrafterInput {
  stepId: string;
  file: string;
  intent: string;
  acceptance: string;
  fileText: string;
  packedContext: string;
}
export interface RedrafterInput {
  stepId: string;
  file: string;
  intent: string;
  acceptance: string;
  fileText: string;
  previousDiff: string;
  failingLog: string;
}

// Algorithm A4 — stripCodeFences.
// 1. s = raw.trim(). 2. If s starts with "```" delete first line through
// first newline. 3. If s ends with "```" delete last line from final
// "```" occurrence. 4. Return s.trim().
export function stripCodeFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const nl = s.indexOf("\n");
    s = nl === -1 ? "" : s.slice(nl + 1);
  }
  if (s.endsWith("```")) {
    const idx = s.lastIndexOf("```");
    s = s.slice(0, idx);
  }
  return s.trim();
}

// Algorithm A7 — isWellFormedDiff.
export function isWellFormedDiff(
  diff: string,
  expectedFile: string,
): { ok: boolean; reason: string } {
  const lines = diff.split("\n");
  for (const line of lines) {
    if (line.includes("\r")) return { ok: false, reason: "CRLF endings present" };
  }
  if (lines[0] !== "--- a/" + expectedFile)
    return { ok: false, reason: "first header mismatch" };
  if (lines[1] !== "+++ b/" + expectedFile)
    return { ok: false, reason: "second header mismatch" };
  let seenHunk = false;
  for (let k = 2; k < lines.length; k++) {
    const line = lines[k] as string;
    if (line.startsWith("@@ ")) {
      seenHunk = true;
      continue;
    }
    if (
      line.startsWith("+") ||
      line.startsWith("-") ||
      line.startsWith(" ") ||
      line.startsWith("\\") ||
      line === ""
    ) {
      continue;
    }
    return { ok: false, reason: "bad hunk line " + k };
  }
  for (let k = 2; k < lines.length; k++) {
    const line = lines[k] as string;
    if (line.startsWith("--- a/") || line.startsWith("+++ b/"))
      return { ok: false, reason: "multi-file diff" };
  }
  if (!seenHunk) return { ok: false, reason: "no hunks" };
  return { ok: true, reason: "well-formed" };
}

let cachedPatchPlanSchema: object | null = null;
function loadPatchPlanSchema(): object {
  if (!cachedPatchPlanSchema) {
    const url = new URL("../../../contracts/patch-plan.schema.json", import.meta.url);
    cachedPatchPlanSchema = JSON.parse(readFileSync(url, "utf8")) as object;
  }
  return cachedPatchPlanSchema;
}

let cachedCandidateDiffSchema: object | null = null;
function loadCandidateDiffSchema(): object {
  if (!cachedCandidateDiffSchema) {
    const url = new URL(
      "../../../contracts/candidate-diff.schema.json",
      import.meta.url,
    );
    cachedCandidateDiffSchema = JSON.parse(readFileSync(url, "utf8")) as object;
  }
  return cachedCandidateDiffSchema;
}

// Algorithm A5 — parsePatchPlan: strip fences, JSON.parse, exactly ONE repair
// pass via chassis renderRepairPrompt + callNemotron role redrafter traceId
// repair-patchplan then re-parse, chassis validate, reject steps.length > 8.
export async function parsePatchPlan(
  raw: string,
): Promise<
  | { ok: true; value: PatchPlan }
  | { ok: false; errors: ValidationError[] }
> {
  let cleaned = stripCodeFences(raw);
  let parsed: unknown = null;
  let parseError = "";
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    parsed = null;
    parseError = String(err);
  }
  if (parsed === null) {
    const repairText = renderRepairPrompt(
      [{ path: "$", message: parseError, code: "parse" }],
      cleaned,
    );
    const repairResponse = await callNemotron({
      role: "redrafter",
      system: "Repair the previous response as valid JSON.",
      user: repairText,
      traceId: "repair-patchplan",
    });
    if (isDegradedResult(repairResponse)) {
      return {
        ok: false,
        errors: [{ path: "$", message: parseError, code: "parse" }],
      };
    }
    cleaned = stripCodeFences(repairResponse.text);
    try {
      parsed = JSON.parse(cleaned);
    } catch (err2) {
      return {
        ok: false,
        errors: [{ path: "$", message: String(err2), code: "parse" }],
      };
    }
  }
  const result = validate(loadPatchPlanSchema(), parsed);
  if (!result.valid) return { ok: false, errors: result.errors };
  const plan = parsed as PatchPlan;
  if (plan.steps.length > 8) {
    return {
      ok: false,
      errors: [
        {
          path: "$.steps",
          message: "steps exceeds maxItems 8",
          code: "maxItems",
        },
      ],
    };
  }
  return { ok: true, value: plan };
}

// Algorithm A6 — parseCandidateDiff: strip fences, JSON.parse, exactly ONE
// repair pass via chassis renderRepairPrompt + callNemotron role redrafter
// traceId repair-diff then re-parse, chassis validate, isWellFormedDiff gate
// mapping failure to path $.unifiedDiff.
export async function parseCandidateDiff(
  raw: string,
): Promise<
  | { ok: true; value: CandidateDiff }
  | { ok: false; errors: ValidationError[] }
> {
  let cleaned = stripCodeFences(raw);
  let parsed: unknown = null;
  let parseError = "";
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    parsed = null;
    parseError = String(err);
  }
  if (parsed === null) {
    const repairText = renderRepairPrompt(
      [{ path: "$", message: parseError, code: "parse" }],
      cleaned,
    );
    const repairResponse = await callNemotron({
      role: "redrafter",
      system: "Repair the previous response as valid JSON.",
      user: repairText,
      traceId: "repair-diff",
    });
    if (isDegradedResult(repairResponse)) {
      return {
        ok: false,
        errors: [{ path: "$", message: parseError, code: "parse" }],
      };
    }
    cleaned = stripCodeFences(repairResponse.text);
    try {
      parsed = JSON.parse(cleaned);
    } catch (err2) {
      return {
        ok: false,
        errors: [{ path: "$", message: String(err2), code: "parse" }],
      };
    }
  }
  const result = validate(loadCandidateDiffSchema(), parsed);
  if (!result.valid) return { ok: false, errors: result.errors };
  const candidate = parsed as CandidateDiff;
  const check = isWellFormedDiff(candidate.unifiedDiff, candidate.file);
  if (!check.ok) {
    return {
      ok: false,
      errors: [
        {
          path: "$.unifiedDiff",
          message: check.reason,
          code: "wellformed",
        },
      ],
    };
  }
  return { ok: true, value: candidate };
}
