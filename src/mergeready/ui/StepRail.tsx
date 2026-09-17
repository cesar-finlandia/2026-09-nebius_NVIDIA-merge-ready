// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { StepStatusIndicator } from "src/platform/ui";

export interface StepRailProps {
  envelopes: EventEnvelope[];
  orientation: "vertical" | "horizontal";
}

const STEP_LABELS: Record<string, string> = {
  intake: "Intake",
  grounding: "Grounding",
  baseline: "Baseline",
  "context-pack": "Context pack",
  planning: "Planning",
  ledger: "Ledger",
  pr: "Pull request",
};

export function StepRail(props: StepRailProps) {
  return (
    <section
      className={props.orientation === "horizontal" ? "mr-rail mr-card is-horizontal" : "mr-rail mr-card"}
      aria-label="Run progress"
    >
      <StepStatusIndicator envelopes={props.envelopes} labelMap={STEP_LABELS} title="" />
    </section>
  );
}
