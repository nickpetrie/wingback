export type ThemeChoice = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "wb-theme";

/** Paints the iOS/Android browser chrome to match. These must stay equal to
 * --color-bg for each theme in globals.css; they're duplicated here because the
 * init script runs before the stylesheet is guaranteed to have applied, so it
 * can't read the token. */
export const THEME_BG: Record<"light" | "dark", string> = {
  light: "#f3f2f2",
  dark: "#141413",
};

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/** Runs as a blocking inline script before the first paint, so the page is
 * never briefly the wrong colour. It has to be self-contained — it's stringified
 * into the document, not bundled — and it must never throw: Safari in private
 * mode throws on localStorage access, and a theme preference is not worth a
 * blank page. "system" is resolved here rather than in a media query so the
 * stylesheet only needs one selector. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var choice = stored === "light" || stored === "dark" ? stored : "system";
    var dark = choice === "dark" ||
      (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", dark ? ${JSON.stringify(THEME_BG.dark)} : ${JSON.stringify(THEME_BG.light)});
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;
