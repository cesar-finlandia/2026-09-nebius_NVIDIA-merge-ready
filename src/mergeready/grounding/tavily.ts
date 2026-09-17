// SPDX-License-Identifier: Apache-2.0
import type { Ticket } from "src/mergeready/orchestrator/types.js";
import { withResilience, isDegradedResult, makeDegradedResult } from "src/resilience/index.js";
import type { DegradedResult, ResilienceConfig } from "src/resilience/index.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";

export interface GroundingResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface GroundingBundle {
  query: string;
  results: GroundingResultItem[];
  fetchedAt: string;
  provider: "tavily";
}

export const GROUNDING_QUERY_MAX = 380;
export const GROUNDING_SUFFIX = "documentation OR migration guide OR breaking changes";
export const GROUNDING_SNIPPET_MAX = 600;
export const GROUNDING_MAX_RESULTS = 5;
export const GROUNDING_FIXTURE_PATH = "examples/mergeready/grounding-fixture.json";
export const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export function detectStackHint(ticket: Ticket): string {
  const hay = ((ticket.title ?? "") + "\n" + (ticket.body ?? "") + "\n" + (ticket.repoUrl ?? "")).toLowerCase();
  if (hay.includes("python")) return "python";
  if (hay.includes("typescript")) return "typescript";
  if (hay.includes("node")) return "node";
  if (hay.includes("react")) return "react";
  return "";
}

export function buildQuery(ticket: Ticket): string {
  const title = (ticket.title ?? "").trim().replace(/\s+/g, " ");
  const body = (ticket.body ?? "").trim().replace(/\s+/g, " ");
  const stack = detectStackHint(ticket);
  let core = title;
  if (core.length < 20 && body.length > 0) {
    core = core + " " + body.slice(0, 120);
  }
  const candidate = (core + " " + stack + " " + GROUNDING_SUFFIX).replace(/\s+/g, " ").trim();
  if (candidate.length <= GROUNDING_QUERY_MAX) return candidate;
  const cut = candidate.slice(0, GROUNDING_QUERY_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 200 ? lastSpace : GROUNDING_QUERY_MAX);
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

interface TavilyRawResult {
  title: string;
  url: string;
  content: string;
}

interface TavilySearchResponse {
  results: TavilyRawResult[];
}

async function tavilySearchOnce(query: string): Promise<TavilySearchResponse> {
  const key = process.env.TAVILY_API_KEY ?? "";
  if (key === "") {
    throw new Error("TAVILY_API_KEY-missing");
  }
  const url = "https://api.tavily.com/search";
  const headers = { Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const body = { query: query, max_results: 5, search_depth: "basic", include_answer: false };
  const res = await fetch(url, { method: "POST", headers: headers, body: JSON.stringify(body) });
  if (!res.ok) {
    throw new Error("tavily-http-" + res.status);
  }
  const json = await res.json();
  if (!json || !Array.isArray((json as TavilySearchResponse).results)) {
    throw new Error("tavily-bad-shape");
  }
  return json as TavilySearchResponse;
}

export function toGroundingBundle(query: string, json: TavilySearchResponse): GroundingBundle {
  const items = (json.results ?? []).slice(0, 5).map((raw) => {
    let title = String((raw as TavilyRawResult)?.title ?? "").trim().slice(0, 200);
    if (title === "") title = "untitled";
    let url = String((raw as TavilyRawResult)?.url ?? "").trim();
    if (url === "") url = "https://api.tavily.com/unresolved";
    const snippet = String((raw as TavilyRawResult)?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    return { title: title, url: url, snippet: snippet };
  });
  return { query: query, results: items, fetchedAt: new Date().toISOString(), provider: "tavily" };
}

export function emptyBundle(query: string): GroundingBundle {
  return { query: query, results: [], fetchedAt: new Date().toISOString(), provider: "tavily" };
}

export const GROUNDING_RESILIENCE: ResilienceConfig = {
  timeout_ms: 8000,
  retries: 1,
  backoff: { policy: "exponential", base_ms: 300, max_ms: 2000, jitter: true },
  fallback_chain: { order: ["cache", "none"] },
  cache_key_strategy: "explicit",
  cache_key_explicit: "",
};

export async function readReplayBundle(): Promise<GroundingBundle | DegradedResult<GroundingBundle>> {
  try {
    // Fixture ships with the entry repo; resolve module-anchored so replay
    // works regardless of process.cwd().
    const fixturePath = isAbsolute(GROUNDING_FIXTURE_PATH)
      ? GROUNDING_FIXTURE_PATH
      : join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", GROUNDING_FIXTURE_PATH);
    const text = await readFile(fixturePath, "utf-8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const query = parsed["query"];
    const results = parsed["results"];
    const fetchedAt = parsed["fetchedAt"];
    if (typeof query !== "string" || query.length === 0) throw new Error("replay-fixture-invalid");
    if (!Array.isArray(results) || results.length > 5) throw new Error("replay-fixture-invalid");
    for (const r of results) {
      const item = r as Record<string, unknown>;
      if (typeof item["title"] !== "string" || typeof item["url"] !== "string" || typeof item["snippet"] !== "string") throw new Error("replay-fixture-invalid");
    }
    return { query: query, results: results as GroundingBundle["results"], fetchedAt: typeof fetchedAt === "string" ? fetchedAt : new Date().toISOString(), provider: "tavily" };
  } catch {
    return makeDegradedResult<GroundingBundle>({ reason: "replay-fixture-invalid", fallback_source: "none", data: { query: "replay-invalid", results: [], fetchedAt: new Date().toISOString(), provider: "tavily" } });
  }
}

export async function groundTicket(ticket: Ticket): Promise<GroundingBundle | DegradedResult<GroundingBundle>> {
  if (process.env.MERGEREADY_MODE === "replay") {
    return readReplayBundle();
  }
  const query = buildQuery(ticket);
  const cacheKey = "tavily:" + sha256Hex(query).slice(0, 16);
  const cfg: ResilienceConfig = { ...GROUNDING_RESILIENCE, cache_key_explicit: cacheKey };
  const raw = await withResilience(() => tavilySearchOnce(query), cfg)();
  if (isDegradedResult(raw)) {
    const reason = typeof raw.reason === "string" && raw.reason !== "" ? raw.reason : "tavily-degraded";
    return makeDegradedResult<GroundingBundle>({
      reason: reason,
      fallback_source: raw.fallback_source ?? "none",
      original_error: raw.original_error ?? raw.reason ?? null,
      data: emptyBundle(query),
    });
  }
  return toGroundingBundle(query, raw);
}
