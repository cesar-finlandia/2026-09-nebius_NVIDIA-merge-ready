// SPDX-License-Identifier: Apache-2.0
import type { RepoFile } from "./snapshot.js";
import type { Ticket } from "../orchestrator/types.js";
import type { GroundingBundle } from "../grounding/tavily.js";
import { fit, count, countBuffer, calcStatus } from "../../context/index.js";
import { isDegradedResult } from "../../resilience/index.js";
import type { Buffer } from "../../context/index.js";

export function scoreFiles(
  files: RepoFile[],
  ticketTitle: string,
  ticketBody: string,
): { path: string; score: number }[] {
  const stop = new Set(["the", "and", "for", "with", "from", "this", "that", "have", "will", "are"]);
  const raw = (ticketTitle + " " + ticketBody).toLowerCase().split(/[^a-z0-9]+/);
  const terms = new Set<string>();
  for (const t of raw) {
    if (t.length < 3) continue;
    if (stop.has(t)) continue;
    terms.add(t);
  }
  function countTermsIn(haystack: string): number {
    let n = 0;
    for (const t of terms) {
      if (haystack.includes(t)) n += 1;
    }
    return n;
  }
  function isTestFile(pathLower: string): number {
    if (pathLower.includes("test") || pathLower.includes("spec")) return 1;
    if (pathLower.endsWith(".test.ts")) return 1;
    if (pathLower.endsWith(".spec.ts")) return 1;
    if (pathLower.endsWith("_test.py")) return 1;
    if (pathLower.endsWith("test_.py")) return 1;
    return 0;
  }
  const out = files.map((f) => {
    const pathLower = f.path.toLowerCase();
    const bodyLower = f.text.toLowerCase();
    let depth = 0;
    for (const ch of f.path) {
      if (ch === "/") depth += 1;
    }
    const score =
      3.0 * countTermsIn(pathLower) + 1.0 * countTermsIn(bodyLower) + 2.0 * isTestFile(pathLower) - 0.1 * depth;
    return { path: f.path, score };
  });
  out.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}

export interface PackedPrompt {
  text: string;
  tokens: number;
  droppedFiles: string[];
  strategy: string;
}

export interface PlannerPackArgs {
  ticket: import("../orchestrator/types.js").Ticket;
  grounding: import("../grounding/tavily.js").GroundingBundle;
  snapshot: import("./snapshot.js").RepoSnapshot;
  contextWindow: number;
}

void (null as unknown as Ticket | null);
void (null as unknown as GroundingBundle | null);

const PLANNER_SYSTEM_TEXT = "You plan minimal code patches. Reply with a PatchPlan only.";
const FIT_STRATEGY = "sliding-window-pinned";
const PROFILE = "generic-heuristic";

export function packPlannerInput(args: PlannerPackArgs): PackedPrompt {
  const window = args.contextWindow >= 8000 ? args.contextWindow : 128000;
  const systemBudget = Math.floor(window * 0.05);
  const ticketBudget = Math.floor(window * 0.15);
  const repoBudget = Math.floor(window * 0.65);
  const reserveBudget = window - systemBudget - ticketBudget - repoBudget;
  const budgetTokens = systemBudget + ticketBudget + repoBudget;
  const systemText = PLANNER_SYSTEM_TEXT;
  const ticket = args.ticket as unknown as { id: string; title: string; body: string };
  const ticketText = "TICKET " + ticket.id + "\n" + ticket.title + "\n" + ticket.body;
  let groundText: string;
  let groundingCount = 0;
  const toGroundText = (query: string, results: { title: string; url: string; snippet: string }[]): string => {
    // DP-GROUND A5.7 step 2 (bonus proof): first up-to-3 results are inlined
    // as a `## Grounding citations` block at the head of the planner prompt
    // text; the full up-to-5 list follows as the GROUNDING query block.
    groundingCount = Array.isArray(results) ? results.length : 0;
    const cited = (Array.isArray(results) ? results : []).slice(0, 3);
    const head = cited.length > 0
      ? "## Grounding citations\n" + cited.map((r) => "- " + r.title + " | " + r.url + " | " + r.snippet).join("\n") + "\n"
      : "";
    const res = (Array.isArray(results) ? results : []).slice(0, 5);
    return head + "GROUNDING query=" + query + "\n" + res.map((r) => "- " + r.title + " | " + r.url + " | " + r.snippet).join("\n");
  };
  const gUnknown = args.grounding as unknown;
  if (isDegradedResult(gUnknown)) {
    const inner = (gUnknown as { data: unknown }).data as unknown;
    if (inner !== null && typeof inner === "object" && typeof (inner as { query?: unknown }).query === "string") {
      const g = inner as { query: string; results: { title: string; url: string; snippet: string }[] };
      const res = Array.isArray(g.results) ? g.results.slice(0, 5) : [];
      groundText = toGroundText(g.query, res);
    } else {
      groundText = "GROUNDING_UNAVAILABLE";
    }
  } else if (gUnknown !== null && typeof gUnknown === "object" && typeof (gUnknown as { query?: unknown }).query === "string") {
    const g = gUnknown as { query: string; results: { title: string; url: string; snippet: string }[] };
    const res = Array.isArray(g.results) ? g.results.slice(0, 5) : [];
    groundText = toGroundText(g.query, res);
  } else {
    groundText = "GROUNDING_UNAVAILABLE";
  }
  const ordered = scoreFiles(args.snapshot.files, ticket.title, ticket.body);
  const byPath = new Map(args.snapshot.files.map((f) => [f.path, f]));
  const buffer: Buffer = [
    { role: "system", content: systemText, metadata: { pinned: true } },
    { role: "user", content: ticketText, metadata: { pinned: true } },
    { role: "user", content: groundText, metadata: { pinned: true } },
  ];
  const orderedPaths: string[] = ordered.map((o) => o.path);
  for (const p of orderedPaths) {
    const f = byPath.get(p);
    if (!f) continue;
    buffer.push({ role: "user", content: "FILE " + f.path + "\n" + f.text, metadata: { pinned: false } });
    if (countBuffer(buffer, PROFILE) > budgetTokens) break;
  }
  const fitConfig = { model_profile: PROFILE, context_window: window, reserved_output: reserveBudget, strategy: FIT_STRATEGY as "sliding-window-pinned" };
  let fitted = fit(buffer, fitConfig).buffer;
  const collectKept = (buf: Buffer): Set<string> => {
    const kept = new Set<string>();
    for (const m of buf) {
      if (typeof m.content === "string" && m.content.startsWith("FILE ")) {
        kept.add(m.content.slice(5).split("\n", 1)[0] as string);
      }
    }
    return kept;
  };
  let kept = collectKept(fitted);
  let droppedFiles = orderedPaths.filter((p) => !kept.has(p));
  const status = calcStatus(fitted, fitConfig);
  if (status.warning === "exceeded" && orderedPaths.length > 0) {
    const keptOrdered = orderedPaths.filter((p) => kept.has(p));
    if (keptOrdered.length > 0) {
      const lastKept = keptOrdered[keptOrdered.length - 1] as string;
      const trimmed: Buffer = fitted.filter((m) => !(typeof m.content === "string" && m.content.startsWith("FILE " + lastKept + "\n")) && !(typeof m.content === "string" && m.content === "FILE " + lastKept));
      const refit = fit(trimmed, fitConfig).buffer;
      const kept2 = collectKept(refit);
      fitted = refit;
      kept = kept2;
      droppedFiles = orderedPaths.filter((p) => !kept.has(p));
      if (!droppedFiles.includes(lastKept)) droppedFiles.push(lastKept);
      droppedFiles.sort((a, b) => orderedPaths.indexOf(a) - orderedPaths.indexOf(b));
    }
  }
  const text = fitted.map((m) => m.role + ":" + m.content).join("\n\n");
  const tokens = countBuffer(fitted, PROFILE);
  return { text, tokens, droppedFiles, strategy: `sliding-window-pinned grounding:${groundingCount}` };
}

export interface DrafterPackArgs {
  stepId: string;
  file: string;
  intent: string;
  acceptance: string;
  fileText: string;
  testFileText: string | null;
  testFilePath: string | null;
  contextWindow: number;
}

function truncateToBudget(text: string, budgetTokens: number): string {
  if (count(text, PROFILE) <= budgetTokens) return text;
  const lines = text.split("\n");
  let kept = "";
  for (let i = 0; i < lines.length; i++) {
    const candidate = i === 0 ? (lines[i] as string) : kept + "\n" + (lines[i] as string);
    if (count(candidate, PROFILE) <= budgetTokens) {
      kept = candidate;
    } else {
      break;
    }
  }
  return kept;
}

export function packDrafterInput(args: DrafterPackArgs): PackedPrompt {
  const window = args.contextWindow >= 8000 ? args.contextWindow : 128000;
  let headerBudget = 2000;
  let fileBudget = 12000;
  let testBudget = 6000;
  let cap = 20000;
  if (window < 20000) {
    cap = Math.floor(window * 0.25);
    fileBudget = Math.floor(cap * 0.60);
    testBudget = Math.floor(cap * 0.30);
    headerBudget = cap - fileBudget - testBudget;
  }
  void headerBudget;
  const headerText = "STEP " + args.stepId + "\nFILE " + args.file + "\nINTENT " + args.intent + "\nACCEPT " + args.acceptance;
  const truncatedFile = truncateToBudget(args.fileText, fileBudget);
  const truncatedTest = args.testFileText === null ? "NO_TEST_FILE" : truncateToBudget(args.testFileText, testBudget);
  const targetContent = "TARGET FILE " + args.file + "\n" + truncatedFile;
  const testContent = "TEST FILE " + (args.testFilePath ?? "none") + "\n" + truncatedTest;
  const buffer: Buffer = [
    { role: "system", content: "You write one unified diff only.", metadata: { pinned: true } },
    { role: "user", content: headerText, metadata: { pinned: true } },
    { role: "user", content: targetContent, metadata: { pinned: false } },
    { role: "user", content: testContent, metadata: { pinned: false } },
  ];
  const fitConfig = { model_profile: PROFILE, context_window: window, reserved_output: window - cap, strategy: FIT_STRATEGY as "sliding-window-pinned" };
  const fitted = fit(buffer, fitConfig).buffer;
  let hasTarget = false;
  let hasTest = false;
  for (const m of fitted) {
    if (m.content === targetContent) hasTarget = true;
    if (m.content === testContent) hasTest = true;
  }
  let droppedFiles: string[];
  if (hasTarget && hasTest) {
    droppedFiles = [];
  } else if (hasTarget && !hasTest) {
    droppedFiles = args.testFilePath !== null ? [args.testFilePath] : [];
  } else {
    droppedFiles = args.testFilePath !== null ? [args.file, args.testFilePath] : [args.file];
  }
  const text = fitted.map((m) => m.role + ":" + m.content).join("\n\n");
  const tokens = countBuffer(fitted, PROFILE);
  return { text, tokens, droppedFiles, strategy: "sliding-window-pinned" };
}

export function reportContextPack(
  packed: PackedPrompt,
  contextWindow: number,
): {
  tokens: number;
  droppedCount: number;
  droppedFiles: string[];
  strategy: string;
  contextWindow: number;
} {
  return {
    tokens: packed.tokens,
    droppedCount: packed.droppedFiles.length,
    droppedFiles: packed.droppedFiles,
    strategy: packed.strategy,
    contextWindow,
  };
}
