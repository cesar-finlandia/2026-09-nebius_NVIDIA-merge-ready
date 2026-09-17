// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildQuery, detectStackHint, toGroundingBundle, groundTicket, GROUNDING_SUFFIX } from "./tavily.js";
import { toCitationProps, receiptLine } from "./citations.js";
import { isDegradedResult } from "src/resilience/index.js";
import type { GroundingBundle } from "./tavily.js";

const SAVED_KEY = process.env.TAVILY_API_KEY;
const SAVED_MODE = process.env.MERGEREADY_MODE;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (SAVED_KEY === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = SAVED_KEY;
  if (SAVED_MODE === undefined) delete process.env.MERGEREADY_MODE;
  else process.env.MERGEREADY_MODE = SAVED_MODE;
  vi.restoreAllMocks();
});

describe("buildQuery", () => {
  it("appends literal suffix", () => {
    const q = buildQuery({ id: "1", title: "Fix login bug", body: "details", repoUrl: "https://example.com/r", branchBase: "main" });
    expect(q.endsWith(GROUNDING_SUFFIX)).toBe(true);
    expect(q).toContain("Fix login bug");
  });
  it("caps at 380 on word boundary", () => {
    const longTitle = ("word ".repeat(200)).trim();
    const q = buildQuery({ id: "1", title: longTitle, body: "", repoUrl: "https://example.com/r", branchBase: "main" });
    expect(q.length).toBeLessThanOrEqual(380);
    expect(q.endsWith(" ")).toBe(false);
  });
});

describe("detectStackHint", () => {
  it("python detected", () => {
    const h = detectStackHint({ id: "1", title: "Python crash", body: "", repoUrl: "https://example.com/r", branchBase: "main" });
    expect(h).toBe("python");
  });
});

describe("toGroundingBundle", () => {
  it("truncates snippets to 600 and caps at 5", () => {
    const raw = { results: Array.from({ length: 7 }, (_, i) => ({ title: "T" + i, url: "https://example.com/" + i, content: "x".repeat(900) })) };
    const bundle = toGroundingBundle("q " + GROUNDING_SUFFIX, raw);
    expect(bundle.results.length).toBe(5);
    for (const r of bundle.results) expect(r.snippet.length).toBeLessThanOrEqual(600);
    expect(bundle.provider).toBe("tavily");
  });
});

describe("groundTicket degraded + replay", () => {
  it("missing key gives degraded empty bundle with provider tavily", async () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.MERGEREADY_MODE;
    const res = await groundTicket({ id: "1", title: "Fix bug", body: "body", repoUrl: "https://example.com/r", branchBase: "main" });
    expect(isDegradedResult(res)).toBe(true);
    const data = (res as unknown as { data: GroundingBundle }).data;
    expect(data.results).toEqual([]);
    expect(data.provider).toBe("tavily");
  });
  it("replay returns fixture bundle with 2 citations without network", async () => {
    process.env.MERGEREADY_MODE = "replay";
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await groundTicket({ id: "1", title: "anything", body: "", repoUrl: "https://example.com/r", branchBase: "main" });
    expect(isDegradedResult(res)).toBe(false);
    const bundle = res as GroundingBundle;
    expect(bundle.provider).toBe("tavily");
    expect(bundle.results.length).toBe(2);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("citations", () => {
  it("toCitationProps length matches and receiptLine names first URL", () => {
    const bundle: GroundingBundle = { query: "q " + GROUNDING_SUFFIX, results: [{ title: "A", url: "https://example.com/a", snippet: "s1" }, { title: "B", url: "https://example.com/b", snippet: "s2" }], fetchedAt: new Date().toISOString(), provider: "tavily" };
    const props = toCitationProps(bundle);
    expect(props.length).toBe(bundle.results.length);
    expect(props[0].index).toBe(0);
    const line = receiptLine(bundle);
    expect(line).toContain("https://example.com/a");
    expect(line.startsWith("grounding: tavily")).toBe(true);
  });
  it("empty bundle yields fallback", () => {
    const bundle: GroundingBundle = { query: "q", results: [], fetchedAt: new Date().toISOString(), provider: "tavily" };
    const props = toCitationProps(bundle);
    expect(props.length).toBe(1);
    expect(props[0].title).toBe("No grounding results");
  });
});
