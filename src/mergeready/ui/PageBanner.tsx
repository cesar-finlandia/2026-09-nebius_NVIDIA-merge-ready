// SPDX-License-Identifier: Apache-2.0
export interface PageBannerProps {
  reasons: { stepId: string; fallbackSource: string; detail: string }[];
}

function detailFor(reason: { stepId: string; fallbackSource: string; detail: string }): string {
  const detail = reason.detail.trim();
  if (detail !== "") return reason.stepId + " → " + detail;
  const source = reason.fallbackSource.trim();
  if (source !== "" && source !== "none") return reason.stepId + " → fell back to " + source;
  return reason.stepId + " → no reason recorded";
}

export function PageBanner(props: PageBannerProps) {
  if (props.reasons.length === 0) return null;
  const shown = props.reasons.slice(0, 3);
  const rest = props.reasons.slice(3);
  return (
    <div
      className="mr-banner mr-banner--page"
      data-message="page"
      role="status"
      aria-live="polite"
      aria-label="Degraded steps"
    >
      <p className="mr-banner__title subject">
        <span aria-hidden="true">◆</span> Running in degraded mode
      </p>
      <dl className="mr-banner__list">
        {shown.map((r) => (
          <div key={r.stepId}>
            <dt className="id">{r.stepId}</dt>
            <dd className="support">{detailFor(r).replace(/^.+? → /, "")}</dd>
          </div>
        ))}
      </dl>
      {rest.length > 0 ? (
        <details>
          <summary className="support">and {rest.length} more</summary>
          <dl className="mr-banner__list">
            {rest.map((r) => (
              <div key={r.stepId}>
                <dt className="id">{r.stepId}</dt>
                <dd className="support">{detailFor(r).replace(/^.+? → /, "")}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
