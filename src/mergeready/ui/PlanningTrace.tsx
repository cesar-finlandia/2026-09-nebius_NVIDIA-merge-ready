// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { CitationDisplay, StreamingTextRenderer } from "src/platform/ui";
import { selectGrounding, selectPlanning } from "./selectors.js";
import type { Verdict } from "./selectors.js";
import { CircleGlyph, DiamondGlyph, SquareGlyph, TriangleGlyph } from "./Glyphs.js";

export interface PlanningTraceProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

function StepVerdict({ verdict }: { verdict: Verdict }) {
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

export function PlanningTrace(props: PlanningTraceProps) {
  const grounding = selectGrounding(props.envelopes, props.traceId);
  const planning = selectPlanning(props.envelopes, props.traceId);

  const stamp = new Date().toISOString();
  const citationEnvelopes: EventEnvelope[] =
    grounding && grounding.results.length > 0
      ? [
          {
            step_id: "grounding",
            status: "done",
            payload: { citations: grounding.results },
            timestamp: stamp,
            sequence: 0,
          },
        ]
      : [];
  const summaryEnvelopes: EventEnvelope[] =
    planning && planning.summary !== ""
      ? [
          {
            step_id: "planning",
            status: "done",
            payload: { text: planning.summary },
            timestamp: stamp,
            sequence: 0,
          },
        ]
      : [];

  return (
    <section className="mr-card" aria-label="Planning trace">
      <h2 className="h2">Plan</h2>
      <div className="mr-grounding">
        {grounding !== null && grounding.query !== "" ? (
          <div className="id">{grounding.query}</div>
        ) : null}
        {grounding !== null && grounding.degraded ? (
          <p className="mr-grounding__fallback small" role="status">
            grounding unavailable — planned without external context
          </p>
        ) : (
          <CitationDisplay
            envelopes={citationEnvelopes}
            emptyText="No sources cited."
            className="mr-grounding__citations"
          />
        )}
      </div>
      <StreamingTextRenderer
        envelopes={summaryEnvelopes}
        emptyText="The plan appears once the planner returns."
        showCursor
        className="mr-plan__summary"
      />
      {planning !== null
        ? planning.steps.map((s) => (
            <div className="mr-planstep" key={s.id}>
              <div className="mr-planstep__head">
                <span className="id">{s.id}</span>
                <span className="id">{s.file}</span>
                <StepVerdict verdict={s.verdict} />
              </div>
              <div>{s.intent}</div>
              <div className="small mr-muted">{s.acceptance}</div>
            </div>
          ))
        : null}
    </section>
  );
}
