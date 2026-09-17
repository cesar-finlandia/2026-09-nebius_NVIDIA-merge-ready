// SPDX-License-Identifier: Apache-2.0
// uc08 — mandatory technology: Sandboxes (the track verb). Offline the
// profile is absent, so the replay branch runs and the scenario is marked
// live-skipped with the named missing key (never deleted).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

const MISSING_KEY = "CONTREE_PROFILE";

test("uc08 sandbox is real (live) or live-skipped (replay)", async ({
  page,
  defaultServer,
}) => {
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");
  const events = await collectEvents(defaultServer.baseURL, traceId);

  // Observable artefacts of a real branch run, read off the seeded
  // verify-1 / reverify-1 pair (never hardcoded).
  const red = events.find((e) => e.step_id === "verify-1" && e.status === "done");
  const green = events.find((e) => e.step_id === "reverify-1" && e.status === "done");
  expect(red, "verify-1 envelope").toBeDefined();
  expect(green, "reverify-1 envelope").toBeDefined();
  const redPayload = red!.payload as {
    branchTag?: unknown;
    parentTag?: unknown;
    verifiedSha?: unknown;
    durationMs?: unknown;
    rolledBack?: unknown;
  };
  expect(String(redPayload.branchTag)).not.toBe(String(redPayload.parentTag));
  expect(String(redPayload.verifiedSha)).toMatch(/^[0-9a-f]{64}$/);
  expect(redPayload.durationMs).toBeGreaterThan(0);
  expect(redPayload.rolledBack).toBe(true);
  const greenPayload = green!.payload as { parentTag?: unknown };
  expect(String(greenPayload.parentTag)).toBe(String(redPayload.parentTag));

  // The matrix shows the rollback honestly: word, glyph and the ↩ mark.
  const matrix = page.getByRole("table", { name: "Sandbox matrix" });
  await expect(matrix.getByText("rolled back").first()).toBeVisible();
  await expect(matrix.getByRole("img", { name: /rolled back/ }).first()).toBeVisible();

  if (!process.env[MISSING_KEY]) {
    test.info().annotations.push({ type: "live-skipped", description: `${MISSING_KEY} absent` });
  }
});
