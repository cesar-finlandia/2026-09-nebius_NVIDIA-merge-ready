// SPDX-License-Identifier: Apache-2.0
// Inline SVG glyphs authored for this entry. Each is aria-hidden; the
// accessible name always comes from the containing control.

export function TriangleGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 1.5 L10.5 10 L1.5 10 Z" fill="currentColor" />
    </svg>
  );
}

export function SquareGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="9" height="9" fill="currentColor" />
    </svg>
  );
}

export function DiamondGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 1 L11 6 L6 11 L1 6 Z" fill="currentColor" />
    </svg>
  );
}

export function CircleGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function RollbackGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M7 2 L3.5 5.5 L7 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 5.5 H10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SunGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M7 0.8 V2.4 M7 11.6 V13.2 M0.8 7 H2.4 M11.6 7 H13.2 M2.6 2.6 L3.7 3.7 M10.3 10.3 L11.4 11.4 M11.4 2.6 L10.3 3.7 M3.7 10.3 L2.6 11.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M11.5 8.5 A4.8 4.8 0 0 1 5.5 2.5 A4.8 4.8 0 1 0 11.5 8.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CaretGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="M2.5 4.5 L6 8 L9.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="6.5" height="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 4 V2.5 A1 1 0 0 0 7 1.5 H2.5 A1 1 0 0 0 1.5 2.5 V7 A1 1 0 0 0 2.5 8 H4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}
