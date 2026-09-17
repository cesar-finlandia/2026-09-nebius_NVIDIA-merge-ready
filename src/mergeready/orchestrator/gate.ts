// SPDX-License-Identifier: Apache-2.0
import type { CandidateDiff } from "src/mergeready/prompts/schemas.js";
import type { SandboxRunResult } from "src/mergeready/sandbox/types.js";
import { createHash } from "node:crypto";

export interface GateVerdict {
  ok: boolean;
  reason: string;
}

export function isMergeable(d: CandidateDiff, r: SandboxRunResult): GateVerdict {
  const sha = createHash("sha256").update(d.unifiedDiff, "utf8").digest("hex");
  if (r.exitCode !== 0) {
    return { ok: false, reason: "exit-code:" + String(r.exitCode) };
  }
  if (r.verifiedSha !== sha) {
    return { ok: false, reason: "sha-mismatch:expected=" + sha + ":got=" + r.verifiedSha };
  }
  if (d.unifiedDiff.length === 0) {
    return { ok: false, reason: "empty-diff" };
  }
  if (d.file.length === 0) {
    return { ok: false, reason: "empty-file" };
  }
  return { ok: true, reason: "green-and-hash-matched" };
}
