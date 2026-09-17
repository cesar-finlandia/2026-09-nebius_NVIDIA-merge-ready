// SPDX-License-Identifier: Apache-2.0
import { MoonGlyph, SunGlyph } from "./Glyphs.js";

export interface ThemeToggleProps {
  theme: "light" | "dark";
  onChange: (t: "light" | "dark") => void;
}

export function ThemeToggle(props: ThemeToggleProps) {
  const dark = props.theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="mr-toggle"
      onClick={() => props.onChange(dark ? "light" : "dark")}
    >
      <span className="mr-toggle__knob" aria-hidden="true">
        {dark ? <MoonGlyph /> : <SunGlyph />}
      </span>
    </button>
  );
}
