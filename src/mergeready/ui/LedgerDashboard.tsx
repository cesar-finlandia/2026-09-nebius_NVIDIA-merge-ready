// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { selectLedger } from "./selectors.js";
import { Metric } from "./Metric.js";
import { HelpPopover } from "./HelpPopover.js";
import { helpContent } from "./helpContent.js";

export interface LedgerDashboardProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

function groupThousands(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function abbreviate(n: number): { text: string; exact: string } {
  const exact = groupThousands(n);
  if (n >= 1000000) return { text: (n / 1000000).toFixed(2) + "M", exact };
  if (n >= 10000) return { text: (n / 1000).toFixed(1) + "k", exact };
  return { text: exact, exact };
}

export function LedgerDashboard(props: LedgerDashboardProps) {
  const view = selectLedger(props.envelopes, props.traceId);

  if (!view) {
    return (
      <section className="mr-card" data-surface="ledger" data-result-region="ledger" aria-label="Ledger">
        <header>
          <h2 className="h2">Ledger</h2>
          <HelpPopover forId="ledger" label={helpContent["ledger"]!.label} copy={helpContent["ledger"]!.copy} />
        </header>
        <div className="mr-tiles">
          <Metric label="Calls" value="—" />
          <Metric label="Tokens in / out" value="—" />
          <Metric label="Sandbox seconds" value="—" />
          <Metric label="This run" value="—" />
        </div>
        <p className="mr-empty small">waiting for the first call</p>
      </section>
    );
  }

  const tokenTotal = view.promptTokens + view.completionTokens;
  const promptShare = tokenTotal > 0 ? (view.promptTokens / tokenTotal) * 100 : 50;
  const completionShare = tokenTotal > 0 ? (view.completionTokens / tokenTotal) * 100 : 50;
  const calls = abbreviate(view.calls);
  const usdText = "$" + view.usd.toFixed(4);

  return (
    <section className="mr-card" data-surface="ledger" data-result-region="ledger" aria-label="Ledger">
      <header>
        <h2 className="h2">Ledger</h2>
        <HelpPopover forId="ledger" label={helpContent["ledger"]!.label} copy={helpContent["ledger"]!.copy} />
      </header>
      {view.degraded ? <span className="mr-chip mr-chip--degraded">degraded</span> : null}
      <div className="mr-tiles">
        <div className="mr-tile">
          <Metric label="Calls" value={calls.text} title={calls.exact} />
        </div>
        <div className="mr-tile">
          <span className="eyebrow">Tokens in / out</span>
          <span className="metric__value" data-metric title={groupThousands(view.promptTokens) + " / " + groupThousands(view.completionTokens)}>
            {groupThousands(view.promptTokens)}
            <span className="metric__sep">/</span>
            {groupThousands(view.completionTokens)}
          </span>
          <span className="metric__unit">tokens</span>
        </div>
        <div className="mr-tile">
          <Metric label="Sandbox seconds" value={view.sandboxSeconds.toFixed(1)} unit="s" title={view.sandboxSeconds.toFixed(1) + " s"} />
        </div>
        <div className={view.overBudget ? "mr-tile mr-tile--over" : "mr-tile"}>
          <Metric label="This run" value={usdText} title={usdText + " USD"} />
          <p className="mr-basis small">
            Local estimate from the published price list — not a billing figure.
          </p>
        </div>
      </div>
      {view.overBudget ? (
        <p className="mr-overbudget small">budget exceeded — planner downgraded</p>
      ) : null}
      <div
        className="mr-ledger__bar"
        role="img"
        aria-label={
          "Token split: " +
          groupThousands(view.promptTokens) +
          " in, " +
          groupThousands(view.completionTokens) +
          " out"
        }
      >
        <div className="mr-ledger__seg--1" style={{ width: promptShare + "%" }}>
          <title>prompt tokens</title>
        </div>
        <div className="mr-ledger__seg--2" style={{ width: completionShare + "%" }}>
          <title>completion tokens</title>
        </div>
      </div>
      {view.downgrades.length > 0 ? (
        <ul className="mr-downgrades">
          {view.downgrades.map((d, i) => (
            <li className="mr-downgrade small" key={i}>
              {d.role} downgraded {d.from} → {d.to}: {d.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
