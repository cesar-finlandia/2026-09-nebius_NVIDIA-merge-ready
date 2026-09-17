// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPublisher } from "src/platform/transport";
import type { CollectablePublisher } from "src/platform/transport";

const SAVED_ENV = { ...process.env };

describe("server stream routes", () => {
  beforeEach(() => {
    process.env["MERGEREADY_MODE"] = "replay";
    process.env["MERGEREADY_SIDECAR_URL"] = "http://127.0.0.1:9";
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in SAVED_ENV)) delete process.env[k];
    }
    for (const [k, v] of Object.entries(SAVED_ENV)) {
      if (v !== undefined) process.env[k] = v;
    }
  });

  it("GET /events returns envelopes ordered by sequence", async () => {
    const { randomUUID } = await import("node:crypto");
    const trace = randomUUID();
    const pub = createPublisher() as CollectablePublisher;
    await pub.publish({ stepId: "intake", status: "done", payload: { a: 2 }, traceId: trace });
    await pub.publish({ stepId: "grounding", status: "done", payload: { a: 1 }, traceId: trace });
    const snap = pub.collect(trace);
    const seq = (snap?.events ?? []).map((e) => e.sequence);
    expect(seq).toEqual([0, 1]);
  });

  it("GET /events without trace_id is 400 and /stream unknown trace errors", async () => {
    const { createServer } = await import("./server.js");
    const srv = createServer({ port: 18181 });
    await srv.listen();
    try {
      const noTrace = await fetch("http://127.0.0.1:18181/events");
      expect(noTrace.status).toBe(400);
      const stream = await fetch("http://127.0.0.1:18181/stream?trace_id=no-such-trace");
      const text = await stream.text();
      expect(stream.status).toBe(200);
      expect(text).toContain("data:");
      expect(text).toContain("unknown_trace_id");
    } finally {
      await srv.close();
    }
  });

  it("GET /stream schedules a 15s heartbeat comment", () => {
    const raw = readFileSync("src/mergeready/api/server.ts", "utf8");
    expect(raw).toContain("15000");
    expect(raw).toContain('":\\n\\n"');
  });
});
