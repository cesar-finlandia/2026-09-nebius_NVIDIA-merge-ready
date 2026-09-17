// SPDX-License-Identifier: Apache-2.0
import type { DegradedReason } from "./selectors.js";

export interface DegradedBannerProps {
  reasons: DegradedReason[];
}

function ReasonLine({ reason }: { reason: DegradedReason }) {
  return (
    <span>
      Step {reason.stepId} degraded via {reason.fallbackSource}: {reason.detail}. Other views remain
      live.
    </span>
  );
}

export function DegradedBanner(props: DegradedBannerProps) {
  if (props.reasons.length === 0) return null;
  if (props.reasons.length > 3) {
    const shown = props.reasons.slice(0, 2);
    const rest = props.reasons.slice(2);
    return (
      <div className="mr-banner" role="status" aria-live="polite" aria-label="Degraded steps">
        <ul>
          {shown.map((r) => (
            <li key={r.stepId}>
              <ReasonLine reason={r} />
            </li>
          ))}
        </ul>
        <details>
          <summary>and {props.reasons.length - 2} more</summary>
          <ul>
            {rest.map((r) => (
              <li key={r.stepId}>
                <ReasonLine reason={r} />
              </li>
            ))}
          </ul>
        </details>
      </div>
    );
  }
  return (
    <div className="mr-banner" role="status" aria-live="polite" aria-label="Degraded steps">
      <ul>
        {props.reasons.map((r) => (
          <li key={r.stepId}>
            <ReasonLine reason={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}
