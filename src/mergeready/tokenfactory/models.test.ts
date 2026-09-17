import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOVERY_REGEX_NANO,
  DISCOVERY_REGEX_SUPER,
  DISCOVERY_REGEX_ULTRA,
  FALLBACK_MODEL_ID,
  resolveModelId,
} from "./models.js";

describe("resolveModelId ladder", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env["NEBIUS_API_KEY"] = "test-key";
    process.env["NEBIUS_BASE_URL"] = "https://api.tokenfactory.nebius.com/v1/";
  });

  it("selects per-tier ids, prefers a12b, caches, and falls back", async () => {
    expect(DISCOVERY_REGEX_ULTRA.test("NVIDIA/Nemotron-3-Ultra-x")).toBe(true);
    expect(DISCOVERY_REGEX_SUPER.test("nvidia/nemotron-3-super-120b-a12b")).toBe(true);
    expect(DISCOVERY_REGEX_NANO.test("nvidia/nemotron-3-nano-a")).toBe(true);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: "nvidia/nemotron-3-ultra-plain" },
          { id: "nvidia/nemotron-3-ultra-with-a12b" },
          { id: "nvidia/nemotron-3-super-120b-a12b" },
          { id: "nvidia/nemotron-3-nano-xyz" },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const ultra = await resolveModelId("planner");
    expect(ultra.source).toBe("discovered");
    expect(ultra.modelId).toContain("a12b");
    expect(ultra.contextWindow).toBe(1000000);
    // cache hit on second call even when network dies
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("down");
    }));
    const ultra2 = await resolveModelId("planner");
    expect(ultra2.source).toBe("discovered");
    expect(ultra2.modelId).toBe(ultra.modelId);
    // degraded discovery paths need a fresh module (empty process cache)
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("down");
    }));
    const fresh = await import("./models.js");
    // degraded discovery -> pinned super
    const superR = await fresh.resolveModelId("planner", "super");
    expect(superR.source).toBe("pinned");
    expect(superR.modelId).toBe(FALLBACK_MODEL_ID);
    // degraded discovery + empty pinned -> fallback
    const nano = await fresh.resolveModelId("drafter", "nano");
    expect(nano.source).toBe("fallback");
    expect(nano.modelId).toBe(FALLBACK_MODEL_ID);
    expect(nano.contextWindow).toBe(1000000);
  });
});
