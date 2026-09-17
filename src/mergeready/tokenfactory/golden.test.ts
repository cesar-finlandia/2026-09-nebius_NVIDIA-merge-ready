import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createGoldenCache, isDegradedResult } from "../../resilience/index.js";

const SYSTEM = "tf-golden-system";
const USER = "tf-golden-user";

function explicitKeyFor(system: string, user: string, role: string): string {
  return `tf:${role}:${createHash("sha256").update(system + user).digest("hex").slice(0, 16)}`;
}

describe("tokenfactory golden replay", () => {
  it("replay hit serves the fixture with zero network calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-golden-"));
    process.env["GOLDEN_CACHE_DIR"] = dir;
    process.env["MERGEREADY_MODE"] = "replay";
    delete process.env["NEBIUS_API_KEY"];
    // FR-09 reconciliation: a replay hit still meters usage to the LOCAL
    // ledger sidecar (best-effort, swallowed on failure). The replay purity
    // guarantee is about EXTERNAL providers: no Token Factory socket may
    // open. Localhost ledger attempts are tolerated and fail closed here.
    const urls: string[] = [];
    const fetchMock = vi.fn(async (input: unknown) => {
      urls.push(String(typeof input === "string" ? input : (input as { url?: unknown }).url ?? input));
      throw new Error("network must not be used in replay mode");
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const explicit = explicitKeyFor(SYSTEM, USER, "drafter");
      const raw = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) as Record<string, { text: string; modelId: string; promptTokens: number; completionTokens: number; latencyMs: number; role: string }>;
      expect(Object.keys(raw)).toContain(explicit);
      const fixture = raw[explicit]!;
      expect(fixture.modelId).toBe("nvidia/nemotron-3-super-120b-a12b");
      const cache = createGoldenCache();
      await cache.put(cache.deriveKey({ explicitKey: explicit }), fixture);
      vi.resetModules();
      const { callNemotron } = await import("./index.js");
      const res = await callNemotron({ role: "drafter", system: SYSTEM, user: USER, traceId: "t-golden" });
      expect(isDegradedResult(res)).toBe(false);
      const ok = res as { text: string; latencyMs: number; modelId: string; promptTokens: number; completionTokens: number };
      expect(ok.text).toBe(fixture.text);
      expect(ok.latencyMs).toBe(0);
      expect(ok.modelId).toBe(fixture.modelId);
      expect(ok.promptTokens).toBe(12);
      expect(ok.completionTokens).toBe(4);
      expect(urls.every((u) => u.includes("127.0.0.1") || u.includes("localhost"))).toBe(true);
      expect(urls.some((u) => u.includes("tokenfactory") || u.includes("tavily"))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("replay miss returns reason replay-miss with zero network calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-golden-miss-"));
    process.env["GOLDEN_CACHE_DIR"] = dir;
    process.env["MERGEREADY_MODE"] = "replay";
    delete process.env["NEBIUS_API_KEY"];
    const fetchMock = vi.fn(async () => {
      throw new Error("network must not be used in replay mode");
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      vi.resetModules();
      const { callNemotron } = await import("./index.js");
      const res = await callNemotron({ role: "drafter", system: "no-such-system", user: "no-such-user", traceId: "t-miss" });
      expect(isDegradedResult(res)).toBe(true);
      if (isDegradedResult(res)) {
        expect(res.reason).toBe("replay-miss");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
