// SPDX-License-Identifier: Apache-2.0
import type { ActivityLine } from "./selectors.js";

export interface WorkIndicatorProps {
  active: boolean;
  line: ActivityLine;
  elapsedS: number;
  stalledS: number | null;
}

export function WorkIndicator(props: WorkIndicatorProps) {
  if (!props.active) return null;
  const stalled = props.stalledS !== null;
  const text = stalled
    ? props.line.text + " — no update for " + props.stalledS + "s"
    : props.line.text;
  return (
    <div className="mr-work" role="status" aria-live="polite" aria-label="Run progress">
      <div className="mr-work__track">
        <div className={stalled ? "mr-work__bar is-stalled" : "mr-work__bar"} />
      </div>
      <div className="mr-work__row">
        <span className="small" data-testid="work-indicator-text">{text}</span>
        <span className="readout" aria-label={"Elapsed " + props.elapsedS.toFixed(1) + " seconds"}>
          {props.elapsedS.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
