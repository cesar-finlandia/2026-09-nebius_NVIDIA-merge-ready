// SPDX-License-Identifier: Apache-2.0
export interface AppBarProps {
  mode: "live" | "replay";
  degraded: boolean;
  onOpenExplainer: () => void;
}

const MARK_PATHS = (
  <>
    <circle cx="7.5" cy="12" r="3.25" fill="currentColor" />
    <path
      d="M7.5 12 L14 21.5 L25.5 7.5"
      stroke="currentColor"
      strokeWidth="3.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

export function AppBar(props: AppBarProps) {
  return (
    <div className="mr-appbar" aria-label="Application bar">
      <div className="mr-appbar__inner">
        <span className="brandmark brandmark--header" aria-label="Merge-Ready — Evidence, not promises.">
          <svg className="brandmark__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            {MARK_PATHS}
          </svg>
          <span className="brandmark__stack">
            <span className="brandmark__word">Merge-Ready</span>
            <span className="brandmark__slogan">Evidence, not promises.</span>
          </span>
        </span>
        <span className="mr-appbar__right">
          <button
            type="button"
            className="mr-btn--explainer"
            data-app-explainer-open
            onClick={props.onOpenExplainer}
          >
            How Merge-Ready works
          </button>
          <span className="mr-chip">{props.mode}</span>
          {props.degraded ? <span className="mr-chip mr-chip--degraded">degraded</span> : null}
        </span>
      </div>
    </div>
  );
}
