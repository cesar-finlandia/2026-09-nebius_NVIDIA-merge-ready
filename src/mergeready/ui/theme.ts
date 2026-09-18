// SPDX-License-Identifier: Apache-2.0
export type ThemeId = "light" | "dark";

export const THEME_STORAGE_KEY = "mr-theme";

export function storedTheme(): ThemeId | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
    return null;
  } catch {
    return null;
  }
}

export function initialTheme(): ThemeId {
  try {
    const saved = storedTheme();
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* private window: fall through to the default */
  }
  // Visual identity plan §2: dark is the primary theme (and the recording theme).
  return "dark";
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private window: session-only theming */
  }
}
