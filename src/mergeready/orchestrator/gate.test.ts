// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { isMergeable } from "./gate.js";

describe("isMergeable", () => {
  const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
  const diff = "diff --git a/f.ts b/f.ts\n+line\n";

  it("accepts green build with matching hash", () => {
    const v = isMergeable(
      { stepId: "s1", file: "f.ts", unifiedDiff: diff, rationale: "r" },
      { branchTag: "b", parentTag: "p", exitCode: 0, stdout: "", stderr: "", durationMs: 1, verifiedSha: sha(diff), rolledBack: false },
    );
    expect(v).toEqual({ ok: true, reason: "green-and-hash-matched" });
  });

  it("rejects non-zero exit code", () => {
    const v = isMergeable(
      { stepId: "s1", file: "f.ts", unifiedDiff: diff, rationale: "r" },
      { branchTag: "b", parentTag: "p", exitCode: 1, stdout: "", stderr: "fail", durationMs: 1, verifiedSha: sha(diff), rolledBack: false },
    );
    expect(v).toEqual({ ok: false, reason: "exit-code:1" });
  });

  it("rejects sha mismatch on tampered diff", () => {
    const v = isMergeable(
      { stepId: "s1", file: "f.ts", unifiedDiff: diff, rationale: "r" },
      { branchTag: "b", parentTag: "p", exitCode: 0, stdout: "", stderr: "", durationMs: 1, verifiedSha: sha("tampered"), rolledBack: false },
    );
    expect(v.ok).toBe(false);
    expect(v.reason.startsWith("sha-mismatch")).toBe(true);
  });

  it("rejects empty diff", () => {
    const v = isMergeable(
      { stepId: "s1", file: "f.ts", unifiedDiff: "", rationale: "r" },
      { branchTag: "b", parentTag: "p", exitCode: 0, stdout: "", stderr: "", durationMs: 1, verifiedSha: sha(""), rolledBack: false },
    );
    expect(v).toEqual({ ok: false, reason: "empty-diff" });
  });
});
