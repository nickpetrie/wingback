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

/** Sets the chrome colour. The `viewport` export in layout.tsx emits one
 * theme-color meta per colour scheme, each behind a media query, so the very
 * first paint is right before any script runs. But the chosen theme can
 * disagree with the OS — Light picked on a dark phone — and then the tag whose
 * media query wins is the wrong one. So every theme-color tag is set to the
 * chosen colour: whichever the browser consults, the answer is the same.
 * THEME_INIT_SCRIPT below does the same thing and has to be self-contained,
 * so it repeats this rather than importing it. */
export function paintThemeColor(dark: boolean) {
  const colour = THEME_BG[dark ? "dark" : "light"];
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", colour);
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => meta.setAttribute("content", colour));
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
    var colour = dark ? ${JSON.stringify(THEME_BG.dark)} : ${JSON.stringify(THEME_BG.light)};
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      var meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", colour);
      document.head.appendChild(meta);
    }
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", colour);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;
