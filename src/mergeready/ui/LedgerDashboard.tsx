// SPDX-License-Identifier: Apache-2.0
import type { EventEnvelope } from "src/platform/transport";
import { selectLedger } from "./selectors.js";

export interface LedgerDashboardProps {
  envelopes: EventEnvelope[];
  traceId?: string;
}

function groupThousands(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function LedgerDashboard(props: LedgerDashboardProps) {
  const view = selectLedger(props.envelopes, props.traceId);

  if (!view) {
    return (
      <section className="mr-card" aria-label="Ledger">
        <h2 className="h2">Ledger</h2>
        <div className="mr-tiles">
          <div className="mr-tile">
            <span className="caption mr-muted">Calls</span>
            <span className="readout-lg">—</span>
          </div>
          <div className="mr-tile">
            <span className="caption mr-muted">Tokens in / out</span>
            <span className="readout-lg">—</span>
          </div>
          <div className="mr-tile">
            <span className="caption mr-muted">Sandbox seconds</span>
            <span className="readout-lg">—</span>
          </div>
          <div className="mr-tile">
            <span className="caption mr-muted">This run</span>
            <span className="readout-lg">—</span>
          </div>
        </div>
        <p className="mr-empty small">waiting for the first call</p>
      </section>
    );
  }

  const tokenTotal = view.promptTokens + view.completionTokens;
  const promptShare = tokenTotal > 0 ? (view.promptTokens / tokenTotal) * 100 : 50;
  const completionShare = tokenTotal > 0 ? (view.completionTokens / tokenTotal) * 100 : 50;

  return (
    <section className="mr-card" aria-label="Ledger">
      <h2 className="h2">Ledger</h2>
      {view.degraded ? <span className="mr-chip mr-chip--degraded">degraded</span> : null}
      <div className="mr-tiles">
        <div className="mr-tile">
          <span className="caption mr-muted">Calls</span>
          <span className="readout-lg">{groupThousands(view.calls)}</span>
        </div>
        <div className="mr-tile">
          <span className="caption mr-muted">Tokens in / out</span>
          <span className="readout-lg">
            {groupThousands(view.promptTokens)} / {groupThousands(view.completionTokens)}
          </span>
        </div>
        <div className="mr-tile">
          <span className="caption mr-muted">Sandbox seconds</span>
          <span className="readout-lg">{view.sandboxSeconds.toFixed(1)} s</span>
        </div>
        <div className={view.overBudget ? "mr-tile mr-tile--over" : "mr-tile"}>
          <span className="caption mr-muted">This run</span>
          <span className="readout-lg">${view.usd.toFixed(4)}</span>
          <p className="mr-honesty small">
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
