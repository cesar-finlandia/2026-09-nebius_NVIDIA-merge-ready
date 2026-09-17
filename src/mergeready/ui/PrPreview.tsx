// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { selectPr } from "./selectors.js";

export interface PrPreviewProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

export function PrPreview(props: PrPreviewProps) {
  const view = selectPr(props.envelopes, props.traceId);

  if (!view || (view.acceptedCount === 0 && view.rejectedCount === 0)) {
    return (
      <section className="mr-card" aria-label="Pull request">
        <h2 className="h2">Pull request</h2>
        <p className="mr-empty">No pull request yet — one is composed when at least one step goes green.</p>
      </section>
    );
  }

  if (view.acceptedCount === 0) {
    return (
      <section className="mr-card" aria-label="Pull request">
        <h2 className="h2">Pull request</h2>
        <p>No pull request. Nothing went green, so nothing is proposed.</p>
      </section>
    );
  }

  const lines = view.unifiedDiff === "" ? [] : view.unifiedDiff.split("\n");

  return (
    <section className="mr-card" aria-label="Pull request">
      <h2 className="h2">Pull request</h2>
      <div className="h3">{view.title}</div>
      <div className="mr-header__meta">
        <span className="id">{view.branch}</span>
        {view.mode === "dry" ? (
          <span className="mr-chip mr-chip--dry">dry run — not published</span>
        ) : null}
        {view.mode === "live" && view.url !== null ? <a href={view.url}>{view.url}</a> : null}
        {view.degraded ? <span className="mr-chip mr-chip--degraded">degraded</span> : null}
      </div>
      {view.body !== "" ? <p>{view.body}</p> : null}
      {lines.length > 0 ? (
        <div className="mr-diff code" aria-label="Unified diff">
          {lines.map((line, i) => {
            const cls =
              line.startsWith("+") && !line.startsWith("+++")
                ? "mr-diff__line mr-diff__line--add"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "mr-diff__line mr-diff__line--del"
                  : "mr-diff__line";
            return (
              <div className={cls} key={i}>
                <span className="mr-diff__gutter" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{line === "" ? " " : line}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {view.receiptMarkdown !== "" ? (
        <>
          <h3 className="h3">Receipt</h3>
          <pre className="mr-receipt code">{view.receiptMarkdown}</pre>
        </>
      ) : null}
    </section>
  );
}
