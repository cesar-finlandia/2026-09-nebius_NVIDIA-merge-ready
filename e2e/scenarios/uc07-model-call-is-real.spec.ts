// SPDX-License-Identifier: Apache-2.0
// uc07 — mandatory technology: Token Factory + an NVIDIA open-source model.
// Offline the credential is absent, so the replay branch runs and the scenario
// is marked live-skipped with the named missing key (never deleted).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

const MISSING_KEY = "NEBIUS_API_KEY";

test("uc07 model call is real (live) or live-skipped (replay)", async ({
  page,
  defaultServer,
}) => {
  if (!process.env[MISSING_KEY]) {
    const traceId = await runExampleTicket(page, defaultServer);
    await waitForStep(defaultServer.baseURL, traceId, "pr");
    const events = await collectEvents(defaultServer.baseURL, traceId);

    // The model id the receipt reports is the one the run actually used —
    // read off the envelopes, never hardcoded.
    const planning = events.find((e) => e.step_id === "planning" && e.status === "done");
    const modelId = String((planning!.payload as { modelId?: unknown }).modelId ?? "");
    expect(modelId.length).toBeGreaterThan(0);
    const ledger = events.find((e) => e.step_id === "ledger" && e.status === "done");
    const ledgerPayload = ledger!.payload as {
      promptTokens?: unknown;
      completionTokens?: unknown;
    };
    expect(ledgerPayload.promptTokens).toBeGreaterThan(0);
    expect(ledgerPayload.completionTokens).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Receipt" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Receipt" });
    await expect(dialog).toBeVisible();
    expect((await dialog.textContent()) ?? "").toContain(modelId);
    test.info().annotations.push({ type: "live-skipped", description: `${MISSING_KEY} absent` });
    return;
  }

  // Live branch: the receipt model id must be listed by the endpoint itself.
  const base = process.env["NEBIUS_BASE_URL"] ?? "https://api.tokenfactory.nebius.com/v1/";
  const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
    headers: { authorization: `Bearer ${process.env[MISSING_KEY]}` },
  });
  expect(res.ok).toBe(true);
  const listed = (await res.json()) as { data?: { id?: unknown }[] };
  const ids = (listed.data ?? []).map((m) => String(m.id));
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");
  const events = await collectEvents(defaultServer.baseURL, traceId);
  const planning = events.find((e) => e.step_id === "planning" && e.status === "done");
  const modelId = String((planning!.payload as { modelId?: unknown }).modelId ?? "");
  expect(ids).toContain(modelId);
});
