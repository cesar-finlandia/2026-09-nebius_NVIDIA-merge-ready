// SPDX-License-Identifier: Apache-2.0
import type { RunHeaderView } from "./selectors.js";
import type { Verdict } from "./selectors.js";
import { CircleGlyph, DiamondGlyph, SquareGlyph, TriangleGlyph } from "./Glyphs.js";

export interface RunHeaderProps {
  view: RunHeaderView | null;
  elapsedS: number;
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  if (verdict === "pass") {
    return (
      <span className="mr-verdict mr-verdict--pass" role="img" aria-label="pass ▲">
        <TriangleGlyph />
        <span>pass</span>
      </span>
    );
  }
  if (verdict === "fail") {
    return (
      <span className="mr-verdict mr-verdict--fail" role="img" aria-label="fail ■">
        <SquareGlyph />
        <span>fail</span>
      </span>
    );
  }
  if (verdict === "rolled-back") {
    return (
      <span className="mr-verdict mr-verdict--rolled" role="img" aria-label="rolled back ◆">
        <DiamondGlyph />
        <span>rolled back</span>
      </span>
    );
  }
  return (
    <span className="mr-verdict mr-verdict--unverified" role="img" aria-label="unverified ○">
      <CircleGlyph />
      <span>unverified</span>
    </span>
  );
}

export function RunHeader(props: RunHeaderProps) {
  if (!props.view) {
    return (
      <header className="mr-header" aria-label="Run header">
        <div className="mr-container">
          <div className="h1">Merge-Ready</div>
        </div>
      </header>
    );
  }
  const view = props.view;
  return (
    <header className="mr-header" aria-label="Run header">
      <div className="mr-container">
        <div className="h1">{view.ticketTitle !== "" ? view.ticketTitle : "Merge-Ready"}</div>
        <div className="mr-header__meta">
          {view.branchBase !== "" ? <span className="id">{view.branchBase}</span> : null}
          {view.traceId !== "" ? <span className="id">{view.traceId}</span> : null}
          {view.verdict !== null ? <VerdictChip verdict={view.verdict} /> : null}
          {view.degraded ? <span className="mr-chip mr-chip--degraded">degraded</span> : null}
        </div>
        <div className="mr-header__chips">
          <span className="mr-chip">{view.mode}</span>
          {view.plannerModelId !== "" ? <span className="mr-chip">{view.plannerModelId}</span> : null}
          <span className="mr-chip">{props.elapsedS.toFixed(1)}s elapsed</span>
        </div>
      </div>
    </header>
  );
}
