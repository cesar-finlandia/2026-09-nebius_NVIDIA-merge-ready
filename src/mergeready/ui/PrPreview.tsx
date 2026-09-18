// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { selectPr } from "./selectors.js";
import { HelpPopover } from "./HelpPopover.js";
import { helpContent } from "./helpContent.js";

export interface PrPreviewProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

export function PrPreview(props: PrPreviewProps) {
  const view = selectPr(props.envelopes, props.traceId);

  if (!view || (view.acceptedCount === 0 && view.rejectedCount === 0)) {
    return (
      <section className="mr-card" data-surface="pr-preview" data-result-region="pr-preview" aria-label="Pull request">
        <header>
          <h2 className="h2">Pull request</h2>
          <HelpPopover forId="pr-preview" label={helpContent["pr-preview"]!.label} copy={helpContent["pr-preview"]!.copy} />
        </header>
        <p className="mr-empty">No pull request yet — one is composed when at least one step goes green.</p>
      </section>
    );
  }

  if (view.acceptedCount === 0) {
    return (
      <section className="mr-card" data-surface="pr-preview" data-result-region="pr-preview" aria-label="Pull request">
        <header>
          <h2 className="h2">Pull request</h2>
          <HelpPopover forId="pr-preview" label={helpContent["pr-preview"]!.label} copy={helpContent["pr-preview"]!.copy} />
        </header>
        <p>No pull request. Nothing went green, so nothing is proposed.</p>
      </section>
    );
  }

  const lines = view.unifiedDiff === "" ? [] : view.unifiedDiff.split("\n");

  return (
    <section className="mr-card" data-surface="pr-preview" data-result-region="pr-preview" aria-label="Pull request">
      <header>
        <h2 className="h2">Pull request</h2>
        <HelpPopover forId="pr-preview" label={helpContent["pr-preview"]!.label} copy={helpContent["pr-preview"]!.copy} />
      </header>
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
        <div className="mr-diff code" data-well="diff" aria-label="Unified diff">
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
        <div data-result-region="receipt">
          <div className="mr-region-head">
            <h3 className="h3 eyebrow">Receipt</h3>
            <HelpPopover forId="receipt" label={helpContent["receipt"]!.label} copy={helpContent["receipt"]!.copy} />
          </div>
          <pre className="mr-receipt code" data-well="receipt">{view.receiptMarkdown}</pre>
        </div>
      ) : null}
    </section>
  );
}
