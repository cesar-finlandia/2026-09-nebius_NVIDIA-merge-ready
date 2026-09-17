// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validate } from "src/resilience";

function schema(): object {
  const url = new URL("../../../contracts/mergeready-run-request.schema.json", import.meta.url);
  const parsed = JSON.parse(readFileSync(url, "utf8")) as Record<string, unknown>;
  const { $schema: _ignored, ...rest } = parsed;
  void _ignored;
  return rest;
}

const GOOD = {
  ticket: { id: "t", title: "ti", body: "b", repoUrl: "https://example.com/r.git", branchBase: "main" },
  repo: { snapshotDir: "." },
};

describe("run-request schema", () => {
  it("accepts a valid body", () => {
    expect(validate(schema(), GOOD).valid).toBe(true);
  });

  it("rejects a body missing ticket", () => {
    expect(validate(schema(), { repo: { snapshotDir: "." } }).valid).toBe(false);
  });

  it("rejects a ticket missing branchBase", () => {
    const bad = { ticket: { id: "t", title: "ti", body: "b", repoUrl: "u" }, repo: { snapshotDir: "." } };
    expect(validate(schema(), bad).valid).toBe(false);
  });
});
