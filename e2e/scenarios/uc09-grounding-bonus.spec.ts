// SPDX-License-Identifier: Apache-2.0
// uc09 — Tavily bonus gate (FR-02). Offline the key is absent, so the replay
// branch runs and the scenario is marked live-skipped with the named missing
// key (never deleted).
import { test, expect, runExampleTicket } from "../fixtures/app.js";
import { collectEvents, waitForStep } from "../fixtures/envelopes.js";

const MISSING_KEY = "TAVILY_API_KEY";
const DEGRADED_COPY = "grounding unavailable — planned without external context";

test("uc09 grounding renders citations (live) or live-skipped (replay)", async ({
  page,
  defaultServer,
}) => {
  const traceId = await runExampleTicket(page, defaultServer);
  await waitForStep(defaultServer.baseURL, traceId, "pr");
  const events = await collectEvents(defaultServer.baseURL, traceId);

  const grounding = events.find((e) => e.step_id === "grounding" && e.status === "done");
  const results = ((grounding!.payload as { results?: unknown }).results as {
    title?: unknown;
    url?: unknown;
  }[]) ?? [];
  expect(results.length).toBeGreaterThan(0);

  // The planning trace renders the query and at least one titled link
  // through CitationDisplay.
  const plan = page.getByRole("region", { name: "Planning trace" });
  await expect(plan).toBeVisible();
  const firstTitle = String(results[0]!.title);
  expect(firstTitle.length).toBeGreaterThan(0);
  const firstLink = plan.getByRole("link", { name: firstTitle });
  await expect(firstLink).toBeVisible();
  expect(await firstLink.getAttribute("href")).toBe(String(results[0]!.url));

  // The key-absent strip copy ships in the built bundle (the degraded branch
  // states it instead of hiding the bonus gate's absence).
  const html = await (await fetch(`${defaultServer.baseURL}/`)).text();
  const bundle = html.match(/\/assets\/[^"]+\.js/)?.[0];
  expect(bundle, "built bundle referenced").toBeDefined();
  const js = await (await fetch(`${defaultServer.baseURL}${bundle}`)).text();
  expect(js).toContain(DEGRADED_COPY);

  if (!process.env[MISSING_KEY]) {
    test.info().annotations.push({ type: "live-skipped", description: `${MISSING_KEY} absent` });
  }
});
