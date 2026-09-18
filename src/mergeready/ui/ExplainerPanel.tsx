// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef } from "react";
import { explainerCopy } from "./helpContent.js";

export interface ExplainerPanelProps {
  open: boolean;
  onClose: () => void;
  onStartDemo: () => void;
}

export function ExplainerPanel(props: ExplainerPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;
  return (
    <section
      className="mr-explainer"
      data-app-explainer
      role="dialog"
      aria-label="How Merge-Ready works"
      aria-modal="true"
      tabIndex={-1}
      ref={(el) => {
        panelRef.current = el;
      }}
    >
      <div className="mr-region-head">
        <h2 className="h2">How Merge-Ready works</h2>
        <button type="button" className="mr-btn mr-btn--secondary" onClick={props.onClose}>
          Close
        </button>
      </div>
      <p>{explainerCopy.what}</p>
      <p className="small">{explainerCopy.who}</p>
      <ol>
        {explainerCopy.flow.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="small">{explainerCopy.howToRead}</p>
      <button type="button" className="mr-btn" onClick={props.onStartDemo}>
        Load example ticket
      </button>
    </section>
  );
}
