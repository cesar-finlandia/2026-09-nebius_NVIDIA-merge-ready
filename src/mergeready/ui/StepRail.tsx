// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { StepStatusIndicator } from "src/platform/ui";
import { HelpPopover } from "./HelpPopover.js";
import { helpContent } from "./helpContent.js";

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
      data-surface="step-rail"
      data-result-region="step-rail"
      aria-label="Run progress"
    >
      <div className="mr-region-head">
        <span className="eyebrow">Steps</span>
        <HelpPopover forId="step-rail" label={helpContent["step-rail"]!.label} copy={helpContent["step-rail"]!.copy} />
      </div>
      <StepStatusIndicator envelopes={props.envelopes} labelMap={STEP_LABELS} title="" />
    </section>
  );
}
