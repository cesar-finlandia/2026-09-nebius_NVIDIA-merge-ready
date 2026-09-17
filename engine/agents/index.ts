// DP-PROMPTS W7 — Engine agent delegation (planner/drafter/redrafter).
import { renderDrafter, renderPlanner, renderRedrafter } from "src/mergeready/prompts/index.js";
import type {
  DrafterInput,
  PlannerInput,
  RedrafterInput,
} from "src/mergeready/prompts/schemas.js";
import { callNemotron } from "src/mergeready/tokenfactory/client.js";
import { withResilience } from "src/resilience";
import type { ResilienceConfig } from "src/resilience";

const PROMPTS_RESILIENCE: ResilienceConfig = {
  timeout_ms: 60000,
  retries: 2,
  backoff: "exponential",
  fallback_chain: { order: ["secondary_provider", "cache", "replay", "none"] },
};

export async function runPlanner(i: PlannerInput, traceId: string) {
  const { system, user } = renderPlanner(i);
  return withResilience(
    () => callNemotron({ role: "planner", system, user, traceId }),
    PROMPTS_RESILIENCE,
  )();
}

export async function runDrafter(i: DrafterInput, traceId: string) {
  const { system, user } = renderDrafter(i);
  return withResilience(
    () => callNemotron({ role: "drafter", system, user, traceId }),
    PROMPTS_RESILIENCE,
  )();
}

export async function runRedrafter(i: RedrafterInput, traceId: string) {
  const { system, user } = renderRedrafter(i);
  return withResilience(
    () => callNemotron({ role: "redrafter", system, user, traceId }),
    PROMPTS_RESILIENCE,
  )();
}
