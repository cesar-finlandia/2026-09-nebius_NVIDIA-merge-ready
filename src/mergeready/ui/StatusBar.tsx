// SPDX-License-Identifier: Apache-2.0
import { ThemeToggle } from "./ThemeToggle.js";

export interface StatusBarProps {
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
  mode: "live" | "replay";
  status: "connecting" | "open" | "closed" | "error";
  onReconnect: () => void;
  buildMarker: string;
  budgetRemainingUsd: number | null;
  onOpenReceipt: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const connection =
    props.status === "closed" ? "snapshot — showing the completed run" : props.status;
  const overBudget = props.budgetRemainingUsd !== null && props.budgetRemainingUsd <= 0;
  return (
    <div className="mr-statusbar" role="contentinfo" aria-label="Session status">
      <div className="mr-statusbar__left">
        <ThemeToggle theme={props.theme} onChange={props.onThemeChange} />
        <span className="mr-chip">{props.mode}</span>
        <span className="mr-conn">{connection}</span>
        {props.status === "error" ? (
          <button type="button" className="mr-link" onClick={props.onReconnect}>
            Reconnect
          </button>
        ) : null}
      </div>
      <div className="mr-statusbar__right">
        <span className="id">{props.buildMarker}</span>
        {props.budgetRemainingUsd !== null ? (
          <span className={overBudget ? "mr-budget mr-budget--over" : "mr-budget"}>
            ${props.budgetRemainingUsd.toFixed(4)} remaining
          </span>
        ) : null}
        <button type="button" className="mr-link" onClick={props.onOpenReceipt} aria-haspopup="dialog">
          Receipt
        </button>
      </div>
      <details className="mr-statusbar__more">
        <summary>details</summary>
        <div className="mr-statusbar__more-body">
          <span className="id">{props.buildMarker}</span>
          {props.budgetRemainingUsd !== null ? (
            <span className={overBudget ? "mr-budget mr-budget--over" : "mr-budget"}>
              ${props.budgetRemainingUsd.toFixed(4)} remaining
            </span>
          ) : null}
          <button type="button" className="mr-link" onClick={props.onOpenReceipt} aria-haspopup="dialog">
            Receipt
          </button>
        </div>
      </details>
    </div>
  );
}
