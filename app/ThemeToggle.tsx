"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isThemeChoice, THEME_BG, THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

// localStorage is an external store, so it's read through useSyncExternalStore
// rather than copied into state in an effect: the server renders the "system"
// snapshot, React swaps to the real one after hydration, and a change in
// another tab lands here too.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function getServerSnapshot(): ThemeChoice {
  return "system";
}

function apply(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_BG[dark ? "dark" : "light"]);
}

function setTheme(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private mode: it still applies for this session, it just isn't remembered.
  }
  apply(choice);
  listeners.forEach((l) => l());
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // On "Auto", follow the OS switching over without needing a reload.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px" }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
        }}
      >
        Theme
      </span>
      <div style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
        {OPTIONS.map((o) => {
          const active = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setTheme(o.value)}
              aria-pressed={active}
              style={{
                padding: "6px 12px",
                border: 0,
                borderLeft: o.value === "light" ? 0 : "1px solid var(--color-divider)",
                cursor: "pointer",
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: 12,
                background: active ? "var(--color-text)" : "transparent",
                color: active ? "var(--color-bg)" : "var(--color-text)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
