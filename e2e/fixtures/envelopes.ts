// SPDX-License-Identifier: Apache-2.0
// Envelope helpers over DP-API's read surface (DP-E2E-BROWSER-TESTING §4).
// No fixed waits: waitForStep polls GET /events until the envelope lands.
import type { EventEnvelope } from "../../src/platform/transport/index.js";

export type { EventEnvelope };

export async function collectEvents(baseURL: string, traceId: string): Promise<EventEnvelope[]> {
  const res = await fetch(`${baseURL}/events?trace_id=${encodeURIComponent(traceId)}`);
  if (!res.ok) throw new Error(`GET /events HTTP ${res.status}`);
  const body = (await res.json()) as { envelopes?: EventEnvelope[] };
  return Array.isArray(body.envelopes) ? body.envelopes : [];
}

export async function waitForStep(
  baseURL: string,
  traceId: string,
  stepId: string,
  timeoutMs = 100000,
): Promise<EventEnvelope> {
  const deadline = Date.now() + timeoutMs;
  let last: EventEnvelope[] = [];
  while (Date.now() < deadline) {
    last = await collectEvents(baseURL, traceId);
    const hit = last.find((e) => e.step_id === stepId && e.status === "done");
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `waitForStep ${stepId} timed out; saw: ${last.map((e) => `${e.step_id}|${e.status}`).join(",")}`,
  );
}

export interface VerifyRow {
  stepId: string;
  exitCode: number | null;
  rolledBack: boolean;
  verdict: string;
}

// Independent derivation of per-attempt outcomes (DP-UI A4 verdict precedence:
// unverified when degraded/exit null, else rolled-back, else pass/fail).
export function verifyRows(envelopes: EventEnvelope[]): VerifyRow[] {
  const rows: VerifyRow[] = [];
  for (const e of envelopes) {
    if (!/^verify-\d+$/.test(e.step_id) && !/^reverify-\d+$/.test(e.step_id)) continue;
    if (e.status !== "done" && e.status !== "error") continue;
    const p = e.payload as {
      exitCode?: unknown;
      rolledBack?: unknown;
      degraded?: unknown;
    };
    const exitCode = typeof p.exitCode === "number" ? p.exitCode : null;
    const rolledBack = p.rolledBack === true;
    const degraded = (e as { degraded?: unknown }).degraded === true || p.degraded === true;
    let verdict = "fail";
    if (degraded || exitCode === null || exitCode === -1) verdict = "unverified";
    else if (rolledBack) verdict = "rolled-back";
    else if (exitCode === 0) verdict = "pass";
    rows.push({ stepId: e.step_id, exitCode, rolledBack, verdict });
  }
  rows.sort((a, b) => a.stepId.localeCompare(b.stepId));
  return rows;
}
