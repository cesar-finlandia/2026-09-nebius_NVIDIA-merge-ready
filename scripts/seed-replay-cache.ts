// SPDX-License-Identifier: Apache-2.0
// Seeds a TF golden cache so UI-driven replay runs go green offline.
// The cache keys are pure functions of (ticket text incl. id, packed
// snapshot, grounding), so this script must run with the SAME snapshot the
// server will load: run it with cwd=examples/mergeready/fixture-repo (or
// pass a snapshotDir that resolves identically) and pin the ticket id via
// Playwright request interception (see e2e/README.md).
// Required env: GOLDEN_CACHE_DIR. Optional: SNAPSHOT_DIR (default "."),
// TICKET_ID (default "e2e-example"), MERGEREADY_MODE=replay (implied).
import { createHash } from "node:crypto";
import { createGoldenCache } from "../src/resilience/index.js";
import { loadRepoSnapshot } from "../src/mergeready/context/snapshot.js";
import { packPlannerInput } from "../src/mergeready/context/pack.js";
import { renderPlanner, renderDrafter, renderRedrafter } from "../src/mergeready/prompts/index.js";
import { resolveModelId } from "../src/mergeready/tokenfactory/models.js";
import { groundTicket } from "../src/mergeready/grounding/tavily.js";
import { isDegradedResult } from "../src/resilience/index.js";
import { EXAMPLE_TICKET } from "../src/mergeready/ui/IntakeForm.js";

process.env["MERGEREADY_MODE"] = "replay";

const sha16 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);
const MODEL = "nvidia/nemotron-3-super-120b-a12b";
const STEP_FILE = "calc.py";
const FILE_TEXT = "def add(a, b):\n    return a + b\n";
const GREEN_S1 =
  "--- a/calc.py\n+++ b/calc.py\n@@ -1,2 +1,6 @@\n def add(a, b):\n     return a + b\n+\n+\n+def sub(a, b):\n+    return a - b\n";
const RED_S2 =
  "--- a/calc.py\n+++ b/calc.py\n@@ -1,2 +1,2 @@\n def add(a, b):\n-    return a + b\n+    return a + b + 1\n";
const GREEN_S2 =
  "--- a/calc.py\n+++ b/calc.py\n@@ -1,2 +1,6 @@\n def add(a, b):\n     return a + b\n+\n+\n+def mul(a, b):\n+    return a * b\n";

const cacheDir = process.env["GOLDEN_CACHE_DIR"];
if (!cacheDir) throw new Error("GOLDEN_CACHE_DIR is required");
const snapshotDir = process.env["SNAPSHOT_DIR"] ?? ".";
const ticketId = process.env["TICKET_ID"] ?? "e2e-example";

const ticket = { id: ticketId, title: EXAMPLE_TICKET.ticketTitle, body: EXAMPLE_TICKET.ticketBody, repoUrl: EXAMPLE_TICKET.repoUrl, branchBase: EXAMPLE_TICKET.branchBase };
const snapshot = await loadRepoSnapshot(snapshotDir);
const g = await groundTicket(ticket as never);
if (isDegradedResult(g)) throw new Error("grounding replay fixture missing");
const grounding = g as never;
const resolved = await resolveModelId("drafter");
const packed = packPlannerInput({ ticket: ticket as never, grounding, snapshot, contextWindow: resolved.contextWindow });

const pr = renderPlanner({ ticketId: ticket.id, ticketTitle: ticket.title, ticketBody: ticket.body, packedContext: packed.text, styleGuide: "", maxSteps: 6 });
const planJson = JSON.stringify({
  summary: "Add sub() and mul() helpers to calc.py.",
  steps: [
    { id: "step-1", file: STEP_FILE, intent: "Add sub(a, b) helper", acceptance: "pytest passes" },
    { id: "step-2", file: STEP_FILE, intent: "Add mul(a, b) helper", acceptance: "pytest passes" },
  ],
});
const d1 = renderDrafter({ stepId: "step-1", file: STEP_FILE, intent: "Add sub(a, b) helper", acceptance: "pytest passes", fileText: FILE_TEXT, packedContext: packed.text });
const d2 = renderDrafter({ stepId: "step-2", file: STEP_FILE, intent: "Add mul(a, b) helper", acceptance: "pytest passes", fileText: FILE_TEXT, packedContext: packed.text });
const r2 = renderRedrafter({ stepId: "step-2", file: STEP_FILE, intent: "Add mul(a, b) helper", acceptance: "pytest passes", fileText: FILE_TEXT, previousDiff: RED_S2, failingLog: "exit-code:1" });

const cache = createGoldenCache();
const seed = async (role: string, system: string, user: string, text: string): Promise<void> => {
  const explicit = `tf:${role}:${sha16(system + user)}`;
  await cache.put(cache.deriveKey({ explicitKey: explicit }), { text, modelId: MODEL, promptTokens: 100, completionTokens: 50, latencyMs: 0, role });
  console.log("seeded " + explicit);
};
await seed("planner", pr.system, pr.user, planJson);
await seed("drafter", d1.system, d1.user, JSON.stringify({ stepId: "step-1", file: STEP_FILE, unifiedDiff: GREEN_S1, rationale: "add sub" }));
await seed("drafter", d2.system, d2.user, JSON.stringify({ stepId: "step-2", file: STEP_FILE, unifiedDiff: RED_S2, rationale: "break add" }));
await seed("redrafter", r2.system, r2.user, JSON.stringify({ stepId: "step-2", file: STEP_FILE, unifiedDiff: GREEN_S2, rationale: "add mul" }));
console.log("seeds-ok " + cacheDir);
