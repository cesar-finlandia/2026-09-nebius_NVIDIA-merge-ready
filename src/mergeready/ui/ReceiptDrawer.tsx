// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef } from "react";

export interface ReceiptDrawerProps {
  open: boolean;
  receiptMarkdown: string | null;
  onClose: () => void;
}

export function ReceiptDrawer(props: ReceiptDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!props.open) return undefined;
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel ? panel.querySelector("button") : null;
    if (first instanceof HTMLElement) first.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        props.onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll("button, a[href], pre[tabindex]"));
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (!(head instanceof HTMLElement) || !(tail instanceof HTMLElement)) return;
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="mr-drawer" role="dialog" aria-modal="true" aria-label="Cost receipt" ref={panelRef}>
      <div className="mr-drawer__head">
        <span className="h3">Receipt</span>
        <button type="button" className="mr-btn-copy" onClick={props.onClose}>
          Close receipt
        </button>
      </div>
      <pre className="mr-drawer__body code" tabIndex={0}>
        {props.receiptMarkdown ?? "No receipt yet."}
      </pre>
    </div>
  );
}
