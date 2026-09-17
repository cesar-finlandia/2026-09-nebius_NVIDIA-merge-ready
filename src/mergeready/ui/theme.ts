// SPDX-License-Identifier: Apache-2.0
export type ThemeId = "light" | "dark";

export const THEME_STORAGE_KEY = "mr-theme";

function prefers(): ThemeId {
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
  } catch {
    /* fall through to the default */
  }
  return "dark";
}

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
  let saved: ThemeId | null = null;
  try {
    saved = storedTheme();
  } catch {
    return prefers();
  }
  if (saved === "light" || saved === "dark") return saved;
  return prefers();
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private window: session-only theming */
  }
}
