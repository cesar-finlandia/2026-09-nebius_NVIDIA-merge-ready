// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { useEventStream } from "src/platform/transport";
import type { EventEnvelope } from "src/platform/transport";
import { setTheme } from "src/platform/ui";
import { applyTheme, initialTheme } from "./theme.js";
import type { ThemeId } from "./theme.js";
import { selectActivityLine, selectDegraded, selectPlanning, selectPr, selectRunHeader } from "./selectors.js";
import { IntakeForm, EXAMPLE_TICKET } from "./IntakeForm.js";
import type { IntakeFormValue } from "./IntakeForm.js";
import { PlanningTrace } from "./PlanningTrace.js";
import { SandboxMatrix } from "./SandboxMatrix.js";
import { PrPreview } from "./PrPreview.js";
import { LedgerDashboard } from "./LedgerDashboard.js";
import { PageBanner } from "./PageBanner.js";
import { AppBar } from "./AppBar.js";
import { ExplainerPanel } from "./ExplainerPanel.js";
import { RunHeader } from "./RunHeader.js";
import { StatusBar } from "./StatusBar.js";
import { WorkIndicator } from "./WorkIndicator.js";
import { StepRail } from "./StepRail.js";
import { ReceiptDrawer } from "./ReceiptDrawer.js";
import { AppFooter } from "./AppFooter.js";

export interface AppProps {
  apiBase?: string;
}

export type UiPhase = "intake" | "running" | "done";

export interface AppState {
  phase: UiPhase;
  traceId: string | null;
  theme: ThemeId;
  receiptOpen: boolean;
}

export function App(props: AppProps) {
  const apiBase = props.apiBase ?? "";
  const [phase, setPhase] = useState<UiPhase>("intake");
  const [traceId, setTraceId] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeId>(() => initialTheme());
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [elapsedS, setElapsedS] = useState(0);
  const [stalledS, setStalledS] = useState<number | null>(null);
  const [mode, setMode] = useState<"live" | "replay">("replay");
  const [buildMarker, setBuildMarker] = useState("dev");
  const [budgetRemainingUsd, setBudgetRemainingUsd] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  const startRef = useRef(0);

  const { envelopes, status, reconnect } = useEventStream(
    traceId ? { traceId, url: props.apiBase ? props.apiBase + "/stream" : undefined } : undefined,
  );

  useEffect(() => {
    setTheme("operator");
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const url = (props.apiBase ?? "") + "/healthz";
    fetch(url)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as Record<string, unknown>;
        if (cancelled) return;
        if (body["mode"] === "live" || body["mode"] === "replay") setMode(body["mode"]);
        const marker = body["buildMarker"] ?? body["build"] ?? body["version"];
        if (typeof marker === "string" && marker !== "") setBuildMarker(marker);
        if (typeof body["budgetRemainingUsd"] === "number" && Number.isFinite(body["budgetRemainingUsd"])) {
          setBudgetRemainingUsd(body["budgetRemainingUsd"] as number);
        }
      })
      .catch(() => {
        /* health is best-effort; defaults stand */
      });
    return () => {
      cancelled = true;
    };
  }, [props.apiBase]);

  let newest: EventEnvelope | null = null;
  for (const e of envelopes) {
    if (traceId && e.trace_id !== traceId) continue;
    if (!newest || e.sequence > newest.sequence) newest = e;
  }

  const scopedTrace = traceId ?? undefined;
  const planning = selectPlanning(envelopes, scopedTrace);
  const line = selectActivityLine(newest, planning ? planning.steps.length : 0);
  const header = selectRunHeader(envelopes, scopedTrace);
  const reasons = selectDegraded(envelopes, scopedTrace);
  const pr = selectPr(envelopes, scopedTrace);

  useEffect(() => {
    if (phase === "running" && (line.done || (status === "closed" && envelopes.length > 0))) {
      setPhase("done");
    }
  }, [phase, line.done, status, envelopes.length]);

  useEffect(() => {
    if (phase !== "running") return undefined;
    const id = window.setInterval(() => {
      setElapsedS((Date.now() - startRef.current) / 1000);
      const stamp = newest ? Date.parse(newest.timestamp) : Number.NaN;
      if (newest && Number.isFinite(stamp)) {
        const gap = (Date.now() - stamp) / 1000;
        setStalledS(gap > 10 ? Math.floor(gap) : null);
      } else {
        setStalledS(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, newest]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  async function handleSubmit(v: IntakeFormValue): Promise<void> {
    setBusy(true);
    setStartError(null);
    const id = crypto.randomUUID();
    try {
      const res = await fetch(apiBase + "/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticket: { id, title: v.ticketTitle, body: v.ticketBody, repoUrl: v.repoUrl, branchBase: v.branchBase },
          repo: { snapshotDir: "examples/mergeready/fixture-repo" },
        }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const body = (await res.json()) as Record<string, unknown>;
      const tid =
        typeof body["trace_id"] === "string" && body["trace_id"] !== ""
          ? (body["trace_id"] as string)
          : id;
      startRef.current = Date.now();
      setElapsedS(0);
      setStalledS(null);
      setTraceId(tid);
      setPhase("running");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const idle = phase === "intake" && envelopes.length === 0;

  return (
    <div className="mr-app" role="group" aria-label="Merge-Ready operator console">
      <AppBar mode={mode} degraded={reasons.length > 0} onOpenExplainer={() => setExplainerOpen(true)} />
      <ExplainerPanel
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        onStartDemo={() => {
          setExplainerOpen(false);
          setPhase("intake");
        }}
      />
      <RunHeader view={header} elapsedS={elapsedS} />
      <PageBanner reasons={reasons} />
      {!idle && !line.done ? (
        <WorkIndicator active line={line} elapsedS={elapsedS} stalledS={stalledS} />
      ) : null}
      {idle ? (
        <main className="mr-container">
          <h1 className="h1">Nothing has been verified yet.</h1>
          <p>Paste a ticket, or load the example. A run takes about a minute.</p>
          <IntakeForm
            disabled={busy}
            busy={busy}
            error={startError}
            onSubmit={(v) => {
              void handleSubmit(v);
            }}
            onLoadExample={() => ({ ...EXAMPLE_TICKET })}
          />
        </main>
      ) : (
        <main className="mr-container mr-grid">
          <div className="mr-main">
            <div className="mr-pos-plan">
              <PlanningTrace envelopes={envelopes} traceId={scopedTrace} />
            </div>
            <div className="mr-pos-matrix">
              <SandboxMatrix envelopes={envelopes} traceId={scopedTrace} />
            </div>
            <div className="mr-pos-pr">
              <PrPreview envelopes={envelopes} traceId={scopedTrace} />
            </div>
          </div>
          <div className="mr-side">
            <div className="mr-pos-rail">
              <StepRail envelopes={envelopes} orientation={narrow ? "horizontal" : "vertical"} />
            </div>
            <div className="mr-pos-ledger">
              <LedgerDashboard envelopes={envelopes} traceId={scopedTrace} />
            </div>
          </div>
        </main>
      )}
      <AppFooter buildMarker={buildMarker} />
      <StatusBar
        theme={theme}
        onThemeChange={(t) => {
          setThemeState(t);
          applyTheme(t);
        }}
        mode={mode}
        status={status}
        onReconnect={reconnect}
        buildMarker={buildMarker}
        budgetRemainingUsd={budgetRemainingUsd}
        onOpenReceipt={() => setReceiptOpen(true)}
      />
      <ReceiptDrawer
        open={receiptOpen}
        receiptMarkdown={pr ? pr.receiptMarkdown : null}
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  );
}
