import { describe, expect, it } from "vitest";
import {
  isWellFormedDiff,
  parseCandidateDiff,
  parsePatchPlan,
} from "../../src/mergeready/prompts/schemas.js";

const GOOD_DIFF = [
  "--- a/src/foo.ts",
  "+++ b/src/foo.ts",
  "@@ -1,2 +1,2 @@",
  "-const x = 1;",
  "+const x = 2;",
  " context line",
].join("\n");

describe("prompts schemas", () => {
  it("parsePatchPlan accepts fenced JSON", async () => {
    const plan = {
      summary: "Fix foo",
      steps: [{ id: "step-1", file: "src/foo.ts", intent: "Fix bug", acceptance: "Unit test passes" }],
    };
    const fenced = "```json\n" + JSON.stringify(plan) + "\n```";
    const res = await parsePatchPlan(fenced);
    expect(res.ok).toBe(true);
  });

  it("parsePatchPlan rejects 9-step plan with maxItems error", async () => {
    const steps = Array.from({ length: 9 }, (_, k) => ({
      id: `step-${(k % 8) + 1}`,
      file: `src/file${k}.ts`,
      intent: `Intent ${k}`,
      acceptance: `Acceptance ${k}`,
    }));
    const res = await parsePatchPlan(JSON.stringify({ summary: "Too many", steps }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const text = res.errors.map((e) => `${e.path} ${e.message} ${e.code}`).join(" | ");
      expect(text.toLowerCase()).toMatch(/maxitems|steps/);
    }
  });

  it("parseCandidateDiff rejects multi-file diff", async () => {
    const multi = [
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+b",
      "--- a/src/bar.ts",
      "+++ b/src/bar.ts",
      "@@ -1,1 +1,1 @@",
      "-c",
      "+d",
    ].join("\n");
    const raw = JSON.stringify({ stepId: "step-1", file: "src/foo.ts", unifiedDiff: multi, rationale: "fix" });
    const res = await parseCandidateDiff(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.path === "$.unifiedDiff")).toBe(true);
    }
    expect(isWellFormedDiff(multi, "src/foo.ts").ok).toBe(false);
  });

  it("isWellFormedDiff accepts a single-file well-formed diff and rejects CRLF", () => {
    const check = isWellFormedDiff(GOOD_DIFF, "src/foo.ts");
    expect(check.ok).toBe(true);
    const crlf = GOOD_DIFF.split("\n").join("\r\n");
    const bad = isWellFormedDiff(crlf, "src/foo.ts");
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/CRLF/);
  });
});
