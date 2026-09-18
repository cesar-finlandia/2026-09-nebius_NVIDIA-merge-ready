// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";

export interface HelpPopoverProps {
  forId: string;
  label: string;
  copy: string;
}

export function HelpPopover(props: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    function onAway(e: MouseEvent): void {
      const el = wrapRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onAway);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onAway);
    };
  }, [open ]);

  return (
    <span ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="mr-help-btn"
        data-help-for={props.forId}
        aria-label={props.label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open ? (
        <span className="mr-help-pop" role="dialog" aria-label={props.label}>
          {props.copy}
        </span>
      ) : null}
    </span>
  );
}
