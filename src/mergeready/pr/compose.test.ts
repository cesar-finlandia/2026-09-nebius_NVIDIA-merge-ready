// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { composePr } from "./index.js";
import type { ComposePrInput } from "./index.js";

function fixture(): ComposePrInput {
  return {
    ticket: { id: "T-42", title: "Fix login bug", body: "Login fails on retry.", repoUrl: "https://github.com/acme/app", branchBase: "main" },
    plan: {
      summary: "Fix retry logic.",
      steps: [
        { id: "s1", file: "a.ts", intent: "fix a", acceptance: "tests pass" },
        { id: "s2", file: "b.ts", intent: "fix b", acceptance: "tests pass" },
      ],
    },
    accepted: [
      {
        step: { id: "s1", file: "a.ts", intent: "fix a", acceptance: "tests pass" },
        diff: { stepId: "s1", file: "a.ts", unifiedDiff: "--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n", rationale: "r" },
        run: { branchTag: "mergeready-t-s1", parentTag: "base", exitCode: 0, stdout: "ok", stderr: "", durationMs: 5, verifiedSha: "abc123def456", rolledBack: false },
      },
    ],
    rejected: [
      {
        step: { id: "s2", file: "b.ts", intent: "fix b", acceptance: "tests pass" },
        diff: { stepId: "s2", file: "b.ts", unifiedDiff: "--- a/b.ts\n+++ b/b.ts\n@@ -1 +1 @@\n-x\n+y\n", rationale: "r" },
        run: null,
        reason: "exit-code:1",
      },
    ],
    runs: [
      { branchTag: "mergeready-t-s1", parentTag: "base", exitCode: 0, stdout: "ok", stderr: "", durationMs: 5, verifiedSha: "abc123def456", rolledBack: false },
    ],
    grounding: null,
    receipt: null,
    traceId: "trace123456789",
    modelByRole: {},
    tokensByRole: {},
  };
}

describe("composePr", () => {
  it("keeps the later diff on file conflict and records a conflict line", () => {
    const input = fixture();
    input.accepted.push({
      step: { id: "s2", file: "a.ts", intent: "fix a again", acceptance: "tests pass" },
      diff: { stepId: "s2", file: "a.ts", unifiedDiff: "--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-new\n+newer\n", rationale: "r2" },
      run: { branchTag: "mergeready-t-s2", parentTag: "base", exitCode: 0, stdout: "ok", stderr: "", durationMs: 5, verifiedSha: "def456", rolledBack: false },
    });
    const p = composePr(input);
    expect(p.unifiedDiff).toContain("+newer");
    expect(p.unifiedDiff).not.toContain("+new\n");
    expect(p.body).toContain("Diff conflicts:");
  });

  it("branch matches mergeready/[a-z0-9-]+-[A-Za-z0-9]{8}", () => {
    const p = composePr(fixture());
    expect(p.branch).toMatch(/^mergeready\/[a-z0-9-]+-[A-Za-z0-9]{8}$/);
  });

  it("title carries accepted/total suffix", () => {
    const p = composePr(fixture());
    expect(p.title).toContain("(Merge-Ready, 1/2 steps verified)");
  });

  it("rejected diffs never appear in unifiedDiff and url is null", () => {
    const p = composePr(fixture());
    expect(p.unifiedDiff).not.toContain("+++ b/b.ts");
    expect(p.url).toBeNull();
  });
});
