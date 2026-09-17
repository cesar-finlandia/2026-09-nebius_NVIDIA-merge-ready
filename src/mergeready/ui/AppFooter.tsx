// SPDX-License-Identifier: Apache-2.0

export interface AppFooterProps {
  buildMarker: string;
}

export function AppFooter(props: AppFooterProps) {
  return (
    <footer className="mr-container mr-footer" role="contentinfo" aria-label="About this tool">
      <span className="strong">Merge-Ready proposes; a human merges.</span>
      <span className="id">{props.buildMarker}</span>
    </footer>
  );
}
