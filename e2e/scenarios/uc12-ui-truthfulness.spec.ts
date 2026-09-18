// SPDX-License-Identifier: Apache-2.0
// uc12 — the screen does not lie (DP-E2E §5 A3): the rendered matrix and
// ledger equal the envelopes that produced them, derived independently.
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";
import type { EventEnvelope } from "../fixtures/envelopes.js";

interface ExpectedRow {
  stepId: string;
  file: string;
  attempt: string;
  branch: string;
  parent: string;
  word: string;
  exit: string;
  duration: string;
  sha8: string;
}

function wordOf(verdict: string): string {
  return verdict === "rolled-back" ? "rolled back" : verdict;
}

function deriveExpected(events: EventEnvelope[]): ExpectedRow[] {
  const files = new Map<string, string>();
  for (const e of events) {
    if (!/^(draft|redraft)-\d+$/.test(e.step_id)) continue;
    const p = e.payload as { stepId?: unknown; file?: unknown };
    if (typeof p.stepId === "string" && typeof p.file === "string" && p.file !== "") {
      files.set(p.stepId, p.file);
    }
  }
  const rows: (ExpectedRow & { index: number; attemptN: number })[] = [];
  for (const e of events) {
    const m = e.step_id.match(/^(re)?verify-(\d+)$/);
    if (!m) continue;
    if (e.status !== "done" && e.status !== "error") continue;
    const index = Number(m[2]);
    const attemptN = m[1] ? 2 : 1;
    const p = e.payload as {
      stepId?: unknown;
      exitCode?: unknown;
      rolledBack?: unknown;
      branchTag?: unknown;
      parentTag?: unknown;
      verifiedSha?: unknown;
      durationMs?: unknown;
    };
    const exitCode = typeof p.exitCode === "number" ? p.exitCode : null;
    const rolledBack = p.rolledBack === true;
    const degraded =
      (e as { degraded?: unknown }).degraded === true ||
      (p as { degraded?: unknown }).degraded === true;
    let verdict = "fail";
    if (degraded || exitCode === null || exitCode === -1) verdict = "unverified";
    else if (rolledBack) verdict = "rolled-back";
    else if (exitCode === 0) verdict = "pass";
    const sha = typeof p.verifiedSha === "string" ? p.verifiedSha : "";
    const durationMs = typeof p.durationMs === "number" ? p.durationMs : null;
    const branch = typeof p.branchTag === "string" && p.branchTag !== "" ? p.branchTag : "—";
    const parent = typeof p.parentTag === "string" && p.parentTag !== "" ? p.parentTag : "—";
    const unitId = typeof p.stepId === "string" ? p.stepId : "";
    rows.push({
      index,
      attemptN,
      stepId: e.step_id,
      file: unitId !== "" && files.has(unitId) ? (files.get(unitId) as string) : "—",
      attempt: String(attemptN),
      branch,
      parent: rolledBack ? parent + "↩" : parent,
      word: wordOf(verdict),
      exit: exitCode === null ? "—" : String(exitCode),
      duration:
        durationMs === null
          ? "—"
          : durationMs < 10000
            ? `${durationMs} ms`
            : `${(durationMs / 1000).toFixed(1)} s`,
      sha8: sha.length >= 8 ? sha.slice(0, 8) : "—",
    });
  }
  rows.sort((a, b) => a.index - b.index || a.attemptN - b.attemptN);
  return rows;
}

test("uc12 rendered matrix and ledger equal the envelopes", async ({ page, defaultServer }) => {
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");
  const events = await collectEvents(defaultServer.baseURL, traceId);

  // Matrix: row count then cell-by-cell at displayed precision.
  const expected = deriveExpected(events);
  expect(expected.length).toBeGreaterThan(0);
  const matrix = page.getByRole("table", { name: "Sandbox matrix" });
  const rendered = await matrix.getByRole("row").all();
  expect(rendered.length - 1).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const cells = await rendered[i + 1]!.getByRole("cell").all();
    const text = async (n: number) => ((await cells[n]!.textContent()) ?? "").trim();
    expect(await text(0)).toBe(expected[i]!.stepId);
    expect(await text(1)).toBe(expected[i]!.file);
    expect(await text(2)).toBe(expected[i]!.attempt);
    expect(await text(3)).toBe(expected[i]!.branch);
    expect(await text(4)).toBe(expected[i]!.parent);
    expect(await text(5)).toBe(expected[i]!.word);
    expect(await text(6)).toBe(expected[i]!.exit);
    expect(await text(7)).toBe(expected[i]!.duration);
    expect(await text(8)).toBe(expected[i]!.sha8);
    // Glyph AND word in every verdict cell.
    await expect(cells[5]!.getByRole("img", { name: expected[i]!.word })).toBeVisible();
  }

  // Ledger tiles equal the last ledger envelope's figures.
  const ledgers = events.filter((e) => e.step_id === "ledger");
  const last = ledgers[ledgers.length - 1]!.payload as {
    calls?: unknown;
    promptTokens?: unknown;
    completionTokens?: unknown;
    usd?: unknown;
    sandboxSeconds?: unknown;
  };
  const tiles = await page
    .getByRole("region", { name: "Ledger" })
    .locator(".readout-lg")
    .allTextContents();
  expect(tiles.map((t) => t.trim())).toEqual([
    String(last.calls),
    `${last.promptTokens} / ${last.completionTokens}`,
    `${Number(last.sandboxSeconds).toFixed(1)} s`,
    `$${Number(last.usd).toFixed(4)}`,
  ]);

  // Status bar build marker equals /health's (/healthz is edge-reserved on Cloud Run).
  const health = (await (await fetch(`${defaultServer.baseURL}/health`)).json()) as {
    buildMarker?: unknown;
    build?: unknown;
    version?: unknown;
  };
  const marker = [health.buildMarker, health.build, health.version].find(
    (v): v is string => typeof v === "string" && v !== "",
  ) ?? "dev";
  await expect(page.getByRole("contentinfo").getByText(marker).first()).toBeVisible();
});
