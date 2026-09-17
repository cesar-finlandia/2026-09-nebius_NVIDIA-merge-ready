// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { runTicket } from "src/mergeready/orchestrator/run.js";
import type { Ticket } from "src/mergeready/orchestrator/types.js";
import type { RepoSnapshot } from "src/mergeready/context/snapshot.js";
import { loadRepoSnapshot } from "src/mergeready/context/snapshot.js";
import { validate } from "src/resilience";
import { createPublisher, resolveTransport } from "src/platform/transport";
import type { CollectablePublisher, Publisher } from "src/platform/transport";
import type { EventEnvelope } from "src/platform/transport";
import { withResilience } from "src/resilience";
import type { ResilienceConfig } from "src/resilience";
import { readEnv } from "./env.js";

export interface CreateServerOpts {
  port: number;
}

export interface ServerHandle {
  listen(): Promise<void>;
  close(): Promise<void>;
}

export interface PostRunsResponse {
  trace_id: string;
}

export interface HealthzResponse {
  ok: true;
  mode: "live" | "replay";
  sidecar: "up" | "down";
  models: Record<string, string>;
}

export interface EventsSnapshot {
  trace_id: string;
  envelopes: EventEnvelope[];
}

const API_RESILIENCE = {
  timeout_ms: 5000,
  retries: 2,
  backoff: "exponential",
  fallback_chain: { order: ["none"] },
  // DP-API §7 literal: the chassis BackoffConfig type drifted to object-only,
  // so the plan-mandated string form is asserted at the boundary. Runtime
  // value stays exactly the §7 literal; the wrapper falls back to its default
  // backoff object for this probe-only call.
} as unknown as ResilienceConfig;

const publishersByTrace = new Map<string, CollectablePublisher>();

let runRequestSchema: object | null = null;
function loadRunRequestSchema(): object {
  if (!runRequestSchema) {
    const url = new URL("../../../contracts/mergeready-run-request.schema.json", import.meta.url);
    const parsed = JSON.parse(readFileSync(url, "utf8")) as Record<string, unknown>;
    // The file keeps its plan-mandated draft-07 `$schema` literal; the
    // chassis ajv-2020 validator only accepts 2020-12, so validate a copy
    // without the `$schema` keyword (all used keywords are identical).
    const { $schema: _ignored, ...rest } = parsed;
    void _ignored;
    runRequestSchema = rest;
  }
  return runRequestSchema as object;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        rejectBody(e);
      }
    });
    req.on("error", rejectBody);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

async function readReplayEnvelopes(traceId: string): Promise<EventEnvelope[]> {
  try {
    const url = new URL("../../../examples/mergeready/golden-run.json", import.meta.url);
    const raw = JSON.parse(await readFile(url, "utf8")) as { envelopes?: EventEnvelope[]; events?: EventEnvelope[] };
    const all = Array.isArray(raw.envelopes) ? raw.envelopes : Array.isArray(raw.events) ? raw.events : [];
    return all
      .filter((e) => !traceId || (e as EventEnvelope).trace_id === traceId)
      .sort((a, b) => (a as EventEnvelope).sequence - (b as EventEnvelope).sequence) as EventEnvelope[];
  } catch {
    return [];
  }
}

function bufferedFor(traceId: string): EventEnvelope[] {
  const pub = publishersByTrace.get(traceId);
  if (pub) {
    const snap = pub.collect(traceId);
    if (snap) return [...snap.events].sort((a, b) => a.sequence - b.sequence);
    return [];
  }
  return [];
}

function errorEnvelope(traceId: string, reason: string): EventEnvelope {
  return {
    step_id: "intake",
    status: "error",
    payload: { reason },
    timestamp: new Date().toISOString(),
    sequence: 0,
    trace_id: traceId,
    degraded: true,
  };
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  // Built console: MR_DIST_DIR wins when set, else the repo-root dist/
  // resolved module-anchored (NOT cwd-anchored) so the server may run with
  // any working directory, e.g. the fixture repo in replay harnesses.
  const dist = process.env["MR_DIST_DIR"] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "dist");
  let path = (req.url ?? "/").split("?")[0] as string;
  if (path === "/") path = "/index.html";
  const file = join(dist, decodeURIComponent(path));
  if (!file.startsWith(dist)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  try {
    if (!existsSync(file) || !statSync(file).isFile()) {
      const index = join(dist, "index.html");
      if (existsSync(index)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(readFileSync(index));
        return;
      }
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  } catch {
    sendJson(res, 404, { error: "not_found" });
  }
}

export function createServer(opts: { port: number }): ServerHandle {
  let http: Server | null = null;
  let sidecar: ChildProcess | null = null;
  let sidecarUp = false;
  const heartbeats = new Set<NodeJS.Timeout>();

  async function handlePostRuns(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "invalid_request", details: [{ path: "$", message: "body is not JSON", code: "parse" }] });
      return;
    }
    const result = validate(loadRunRequestSchema(), body);
    if (!result.valid) {
      sendJson(res, 400, { error: "invalid_request", details: result.errors });
      return;
    }
    const env = readEnv();
    const typed = body as { ticket: Ticket; repo: { snapshotDir: string } };
    const traceId = randomUUID();
    const publisher = createPublisher() as CollectablePublisher;
    publishersByTrace.set(traceId, publisher);
    const publish = ((o: { stepId: string; status: "started" | "streaming" | "done" | "error"; payload?: Record<string, unknown>; traceId?: string; degraded?: boolean }) =>
      (publisher as Publisher).publish(o)) as unknown as Parameters<typeof runTicket>[0]["publish"];
    let snapshot: RepoSnapshot;
    try {
      snapshot = await loadRepoSnapshot(typed.repo.snapshotDir);
    } catch {
      snapshot = { root: typed.repo.snapshotDir, files: [], testCommand: "npm test", baseImage: "ubuntu:latest" };
      await publisher.publish({ stepId: "intake", status: "error", payload: { reason: "snapshot-failed" }, traceId, degraded: true });
    }
    // Step cap at MERGEREADY_MAX_STEPS is enforced inside runTicket via readEnv().
    runTicket({ ticket: typed.ticket, snapshot: snapshot!, traceId, publish }).catch(async (e: unknown) => {
      try {
        await publisher.publish({
          stepId: "pr",
          status: "error",
          payload: { reason: e instanceof Error ? e.message : String(e) },
          traceId,
          degraded: true,
        });
      } catch {
        // publish best-effort only
      }
    });
    const out: PostRunsResponse = { trace_id: traceId };
    sendJson(res, 202, out);
  }

  function handleGetEvents(req: IncomingMessage, res: ServerResponse): void {
    const u = new URL(req.url ?? "/events", "http://localhost");
    const traceId = u.searchParams.get("trace_id") ?? "";
    if (!traceId) {
      sendJson(res, 400, { error: "missing_trace_id" });
      return;
    }
    void (async () => {
      let envelopes = bufferedFor(traceId);
      if (envelopes.length === 0) envelopes = await readReplayEnvelopes(traceId);
      // EventsSnapshot ({trace_id, envelopes}) is the DP-API shape consumed by
      // e2e fixtures; status/events are the chassis fetchEventFallback shape
      // (NFR-08) — same bytes, both keys, no second contract.
      const snap: EventsSnapshot & { status: "complete"; events: EventEnvelope[] } = {
        trace_id: traceId,
        envelopes,
        status: "complete",
        events: envelopes,
      };
      sendJson(res, 200, snap);
    })();
  }

  function handleGetStream(req: IncomingMessage, res: ServerResponse): void {
    const rawPath = ((req.url ?? "/stream").split("?")[0] as string) || "/stream";
    const u = new URL(req.url ?? "/stream", "http://localhost");
    const traceId = u.searchParams.get("trace_id") ?? "";
    if (!traceId) {
      // DP-API A-02 keeps 400 on /stream. The chassis-default /events/stream
      // alias answers an empty 200 stream instead: the console mounts
      // useEventStream before any run exists, and a failing request would trip
      // the browser console gate — an open stream with no frames does not.
      if (rawPath !== "/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const idle = setInterval(() => {
          res.write(":\n\n");
        }, 15000);
        heartbeats.add(idle);
        req.on("close", () => {
          clearInterval(idle);
          heartbeats.delete(idle);
        });
        return;
      }
      sendJson(res, 400, { error: "missing_trace_id" });
      return;
    }
    resolveTransport();
    const pub = publishersByTrace.get(traceId);
    // Chassis framing (DP-B §4.3): named `envelope` events — the browser
    // subscriber only fires on `event: envelope`, bare data: frames are ignored.
    const writeEnv = (e: EventEnvelope): void => {
      res.write(`event: envelope\ndata: ${JSON.stringify(e)}\n\n`);
    };
    const heartbeat = setInterval(() => {
      res.write(":\n\n");
    }, 15000);
    heartbeats.add(heartbeat);
    req.on("close", () => {
      clearInterval(heartbeat);
      heartbeats.delete(heartbeat);
    });
    // Publisher-backed traces delegate headers to the hub (it writes its own
    // writeHead on attach — writing ours first throws ERR_HTTP_HEADERS_SENT
    // and kills the process). Buffered frames go right after its `: connected`
    // comment; all are valid SSE frames in either order.
    if (pub) {
      pub.asSseStream(req, res);
      for (const e of bufferedFor(traceId)) writeEnv(e);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    void (async () => {
      const replay = await readReplayEnvelopes(traceId);
      if (replay.length === 0) {
        writeEnv(errorEnvelope(traceId, "unknown_trace_id"));
        clearInterval(heartbeat);
        heartbeats.delete(heartbeat);
        res.end();
        return;
      }
      for (const e of replay) writeEnv(e);
      clearInterval(heartbeat);
      heartbeats.delete(heartbeat);
      res.end();
    })();
  }

  function handleGetHealthz(_req: IncomingMessage, res: ServerResponse): void {
    void (async () => {
      const env = readEnv();
      let models: Record<string, string> = {};
      try {
        const url = new URL("../../../config/model-profiles.json", import.meta.url);
        const cfg = JSON.parse(await readFile(url, "utf8")) as { roles?: Record<string, string>; profiles?: Record<string, { model?: string }> };
        for (const role of ["mergeready_planner", "mergeready_drafter", "mergeready_redrafter"]) {
          const profile = cfg.roles?.[role];
          models[role] = (profile && cfg.profiles?.[profile]?.model) || "";
        }
      } catch {
        models = {};
      }
      const probe = await withResilience(async () => {
        const r = await fetch(env.MERGEREADY_SIDECAR_URL + "/healthz", { method: "GET" });
        if (!r.ok) throw new Error("sidecar HTTP " + r.status);
        return true;
      }, API_RESILIENCE)();
      const up = probe === true || (typeof probe === "object" && probe !== null && !(probe as { degraded?: unknown }).degraded);
      const body: HealthzResponse = { ok: true, mode: env.MERGEREADY_MODE, sidecar: up || sidecarUp ? "up" : "down", models };
      sendJson(res, 200, body);
    })();
  }

  async function superviseSidecar(): Promise<void> {
    const env = readEnv();
    if (env.MERGEREADY_SIDECAR_URL !== "http://127.0.0.1:8787") return;
    try {
      sidecar = spawn("python", ["-m", "src.mergeready.sidecar"], { stdio: "pipe" });
      sidecar.on("error", () => {
        sidecar = null;
      });
    } catch {
      sidecar = null;
    }
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const r = await fetch("http://127.0.0.1:8787/healthz", { method: "GET" });
        if (r.ok) {
          sidecarUp = true;
          return;
        }
      } catch {
        // keep polling
      }
    }
    console.log("sidecar unavailable, continuing degraded");
    sidecarUp = false;
  }

  return {
    async listen(): Promise<void> {
      await superviseSidecar();
      http = createHttpServer((req, res) => {
        const method = req.method ?? "GET";
        const path = (req.url ?? "/").split("?")[0];
        try {
          if (method === "POST" && path === "/runs") {
            void handlePostRuns(req, res);
            return;
          }
          if (method === "GET" && path === "/events") {
            handleGetEvents(req, res);
            return;
          }
          if (method === "GET" && (path === "/stream" || path === "/events/stream")) {
            handleGetStream(req, res);
            return;
          }
          if (method === "GET" && path === "/healthz") {
            handleGetHealthz(req, res);
            return;
          }
          if (method === "GET") {
            serveStatic(req, res);
            return;
          }
          sendJson(res, 404, { error: "not_found" });
        } catch {
          try {
            sendJson(res, 500, { error: "internal" });
          } catch {
            // response already closed
          }
        }
      });
      await new Promise<void>((resolveListen, rejectListen) => {
        http!.once("error", rejectListen);
        http!.listen(opts.port, () => resolveListen());
      });
    },
    async close(): Promise<void> {
      for (const h of heartbeats) clearInterval(h);
      heartbeats.clear();
      await new Promise<void>((resolveClose) => {
        if (!http) {
          resolveClose();
          return;
        }
        http.close(() => resolveClose());
      });
      http = null;
      if (sidecar) {
        try {
          sidecar.kill();
        } catch {
          // already exited
        }
        sidecar = null;
      }
    },
  };
}
