// SPDX-License-Identifier: Apache-2.0
import { Fragment, useState } from "react";
import type { EventEnvelope } from "src/platform/transport";
import { buildMatrixRows } from "./selectors.js";
import type { MatrixRow, Verdict } from "./selectors.js";
import { CaretGlyph, CircleGlyph, CopyGlyph, DiamondGlyph, SquareGlyph, TriangleGlyph } from "./Glyphs.js";

export interface SandboxMatrixProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

function VerdictCell({ verdict }: { verdict: Verdict }) {
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

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 10000) return ms + " ms";
  return (ms / 1000).toFixed(1) + " s";
}

function RowDetail({ row }: { row: MatrixRow }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(): void {
    setCopied(false);
    try {
      const text = row.stdoutTail.join("\n");
      const nav = typeof navigator !== "undefined" ? navigator : null;
      const clipboard = nav && "clipboard" in nav ? nav.clipboard : null;
      if (clipboard && typeof clipboard.writeText === "function") {
        clipboard
          .writeText(text)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="mr-log">
      <div className="mr-log__bar">
        <span className="caption mr-muted">Log tail</span>
        <button
          type="button"
          className="mr-btn-copy"
          onClick={handleCopy}
          aria-label={"Copy log for " + row.stepId}
        >
          <CopyGlyph />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {row.rolledBack ? (
        <p className="mr-log__discard">branch discarded; baseline tag untouched</p>
      ) : null}
      <p className="mr-log__discard mr-muted">
        <span className="id">
          {row.parentTag} · {row.verifiedSha8}
        </span>
      </p>
      <pre className="mr-log__lines code">{row.stdoutTail.join("\n")}</pre>
    </div>
  );
}

export function SandboxMatrix(props: SandboxMatrixProps) {
  const rows = buildMatrixRows(props.envelopes, props.traceId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section className="mr-card" aria-label="Sandbox verification matrix">
        <h2 className="h2">Sandbox matrix</h2>
        <p className="mr-empty">No branches yet — the first one opens once the planner returns steps.</p>
      </section>
    );
  }

  return (
    <section className="mr-card" aria-label="Sandbox verification matrix">
      <h2 className="h2">Sandbox matrix</h2>
      <div className="mr-matrix-wrap">
        <table className="mr-matrix" aria-label="Sandbox matrix">
          <thead>
            <tr className="caption">
              <th scope="col">Step</th>
              <th scope="col">File</th>
              <th scope="col">Attempt</th>
              <th scope="col">Branch tag</th>
              <th scope="col" className="mr-col-parent">Parent tag</th>
              <th scope="col">Verdict</th>
              <th scope="col">Exit</th>
              <th scope="col">Duration</th>
              <th scope="col" className="mr-col-sha">Verified SHA</th>
              <th scope="col">
                <span className="mr-muted">Log</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = expanded === row.stepId;
              return (
                <Fragment key={row.stepId}>
                  <tr className={"mr-row--" + row.verdict + " landed"}>
                    <td>
                      <span className="id">{row.stepId}</span>
                    </td>
                    <td>
                      <span className="id">{row.file}</span>
                    </td>
                    <td>
                      <span className="readout">{row.attempt}</span>
                    </td>
                    <td>
                      <span className="id">{row.branchTag}</span>
                    </td>
                    <td className="mr-col-parent">
                      <span className="id">
                        {row.parentTag}
                        {row.rolledBack ? (
                          <span
                            className="mr-rollback-mark"
                            role="img"
                            aria-label="rolled back ↩"
                          >
                            ↩
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td>
                      <VerdictCell verdict={row.verdict} />
                    </td>
                    <td>
                      <span className="readout">{row.exitCode === null ? "—" : String(row.exitCode)}</span>
                    </td>
                    <td>
                      <span className="readout">{formatDuration(row.durationMs)}</span>
                    </td>
                    <td className="mr-col-sha">
                      <span className="id">{row.verifiedSha8}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mr-btn-copy"
                        aria-expanded={open}
                        aria-label={(open ? "Hide log for " : "Show log for ") + row.stepId}
                        onClick={() => setExpanded(open ? null : row.stepId)}
                      >
                        <CaretGlyph />
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={row.stepId + "-log"}>
                      <td colSpan={10}>
                        <RowDetail row={row} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
