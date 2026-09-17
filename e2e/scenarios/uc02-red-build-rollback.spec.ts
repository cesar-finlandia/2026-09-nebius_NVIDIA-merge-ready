// SPDX-License-Identifier: Apache-2.0
// uc02 — a red build is rolled back and re-drafted exactly once (FR-05/FR-06).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

test("uc02 red build rolls back, exactly one re-draft", async ({ page, defaultServer }) => {
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");

  const matrix = page.getByRole("table", { name: "Sandbox matrix" });
  await expect(matrix).toBeVisible();

  // The rolled-back row carries the word AND the glyph (DP-UI §5A.3).
  const rolled = matrix.getByText("rolled back").first();
  await expect(rolled).toBeVisible();
  await expect(matrix.getByRole("img", { name: /rolled back/ }).first()).toBeVisible();

  // Exactly one re-draft / re-verify pair for the red step: no third attempt.
  const events = await collectEvents(defaultServer.baseURL, traceId);
  const done = (id: string) =>
    events.filter((e) => e.step_id === id && (e.status === "done" || e.status === "error"));
  expect(done("redraft-1").length).toBe(1);
  expect(done("reverify-1").length).toBe(1);
  expect(
    events.filter(
      (e) => /^(redraft|reverify)-/.test(e.step_id) && (e.status === "done" || e.status === "error"),
    ).length,
  ).toBe(done("redraft-1").length + done("reverify-1").length);
  const red = done("verify-1")[0];
  expect(red, "verify-1 envelope exists").toBeDefined();
  expect((red!.payload as { exitCode?: unknown }).exitCode).not.toBe(0);
  expect((red!.payload as { rolledBack?: unknown }).rolledBack).toBe(true);

  // The expanded log of the rolled-back row carries the literal discard line.
  await matrix.getByRole("button", { name: "Show log for verify-1" }).click();
  await expect(
    page.getByText("branch discarded; baseline tag untouched").first(),
  ).toBeVisible();
});
