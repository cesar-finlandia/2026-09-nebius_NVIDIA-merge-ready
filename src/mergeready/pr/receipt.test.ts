// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, beforeEach } from "vitest";
import { renderReceiptMarkdown, publishPr } from "./index.js";

const RECEIPT = {
  traceId: "t-receipt",
  calls: 3,
  promptTokens: 1000,
  completionTokens: 500,
  usd: 0.0123,
  sandboxSeconds: 120,
  downgrades: [],
};

describe("renderReceiptMarkdown", () => {
  it("renders one row per role with est. $ prefix", () => {
    const md = renderReceiptMarkdown(
      RECEIPT,
      { planner: "nvidia/nemotron-3-super-120b-a12b", drafter: "nvidia/nemotron-3-nano-x" },
      { planner: { promptTokens: 800, completionTokens: 200 }, drafter: { promptTokens: 200, completionTokens: 300 } },
    );
    expect(md).toContain("| planner |");
    expect(md).toContain("| drafter |");
    expect(md).toContain("est. $");
    expect(md).toContain("| total |");
    expect(md).toContain("min / est. $");
  });

  it("renders the no-downgrades literal for empty downgrades", () => {
    const md = renderReceiptMarkdown(RECEIPT, {}, {});
    expect(md).toContain("No downgrades — full-tier run.");
  });

  it("renders the ledger-unavailable line for null receipt", () => {
    const md = renderReceiptMarkdown(null, {}, {});
    expect(md).toContain("No receipt — ledger unavailable for this run.");
  });
});

describe("publishPr dry", () => {
  beforeEach(() => {
    process.env["MERGEREADY_PR_MODE"] = "dry";
  });

  it("writes both out/pr files and returns url null", async () => {
    // Dry publish anchors out/pr at the repo root regardless of cwd.
    const res = await publishPr(
      { title: "t", body: "b", branch: "mergeready/x-12345678", unifiedDiff: "diff", receiptMarkdown: "r", url: null },
      "dry",
    );
    expect(res).toEqual({ url: null });
    const { readFileSync, existsSync, rmSync } = await import("node:fs");
    const { join: joinPath, dirname: dirName } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = joinPath(dirName(fileURLToPath(import.meta.url)), "..", "..", "..");
    const md = joinPath(root, "out", "pr", "mergeready-x-12345678.md");
    const diff = joinPath(root, "out", "pr", "mergeready-x-12345678.diff");
    try {
      expect(existsSync(md)).toBe(true);
      expect(existsSync(diff)).toBe(true);
      expect(readFileSync(diff, "utf8")).toContain("diff");
    } finally {
      rmSync(md, { force: true });
      rmSync(diff, { force: true });
    }
  });
});
