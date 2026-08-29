import { readFileSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Two layout regressions in one week got past typecheck, lint and the build,
// and both had the same shape: something inside a grid track refused to shrink
// and made the whole page wider than the phone, so iOS Safari zoomed the app
// out to fit. Neither is visible to any other kind of test.
//
// This renders the real stylesheet over markup shaped like the real pages and
// asserts the one invariant that matters: the document never scrolls
// sideways. It deliberately does not check that anything *looks* right — that
// is a job for eyes — only that the page fits.
//
// Worth knowing before you trust it: the fix it guards is a chain — a
// minmax(0, …) track plus min-width: 0 on every box between it and the chip
// row — and removing any single link does not fail these tests, because the
// remaining two still hold the width down. Removing the chain does fail them,
// which was checked rather than assumed. So this catches the page blowing
// out; it does not catch the defence getting thinner.
//
// The four widths are the iPhones this is actually read on: SE, 13 mini/8,
// 14/15, and the Pro Max.
const WIDTHS = [320, 375, 390, 430];

// The same phones with the height Safari actually leaves you after its own
// chrome — which is what "above the fold" has to be measured against, and is
// well short of the device height these are usually quoted at.
const PHONES = [
  { width: 320, height: 568, usable: 460 },
  { width: 375, height: 667, usable: 553 },
  { width: 390, height: 844, usable: 740 },
  { width: 430, height: 932, usable: 828 },
];

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
  // Tailwind's import can't resolve from a file:// page and nothing here
  // depends on it; the design system is plain CSS.
  .replace('@import "tailwindcss";', "");

const CLUBS = ["ARS", "AVL", "BOU", "BRE", "BHA", "BUR", "CHE", "CRY", "EVE", "FUL",
  "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT", "WHU", "WOL"];

const box = (w: number | string, h: number | string) =>
  `<span style="display:block;flex:none;width:${w};height:${h};background:#555"></span>`;

/** Home, with the picker open over a club's squad — the state that broke. */
function homePage(): string {
  const standings = ["Nick", "Tom", "Alex", "Henry", "Casra"]
    .map(
      (name, i) => `<button class="wb-standing${i === 0 ? " wb-standing-me" : ""}">
        <span class="wb-standing-rank">0${i + 1}</span>${box("24px", "24px")}
        <span class="wb-standing-who"><span class="wb-standing-name">${name}</span>
        <span class="wb-standing-stars">★★</span></span>
        <span class="wb-standing-points">12</span></button>`,
    )
    .join("");

  const chips = CLUBS.map(
    (c) => `<button class="wb-chip">${box("18px", "18px")}<span>${c}</span></button>`,
  ).join("");

  const players = ["Gyökeres", "Saka", "Havertz", "Martinelli"]
    .map(
      (n, i) => `<button class="wb-player-row${i === 2 ? " wb-player-row-locked" : ""}">
        <span class="wb-player-photo"></span>
        <span class="wb-player-detail">
          <span class="wb-player-name">${n}${i === 0 ? '<span class="wb-flag wb-flag-warn">Doubtful</span>' : ""}</span>
          <span class="wb-player-club">${box("14px", "14px")}Arsenal · FWD</span>
          <span class="wb-player-stats">4 goals · 2 assists · 8 starts</span>
        </span>
        ${i === 2 ? '<span class="wb-player-locked-flag">🔒 GW1</span>' : ""}</button>`,
    )
    .join("");

  // Two of the four carry a LIVE badge: it shares the entrant's line, so it is
  // the badge most likely to push a narrow card wider than its column.
  const others = ["Tom", "Alex", "Henry", "Casra"]
    .map(
      (who, i) => `<div class="wb-other">
        <span class="wb-other-photo" style="background:#7d2b28"></span>
        <div class="wb-other-detail">
          <p class="wb-other-who">${who}${
            i % 2 === 0 ? '<span class="wb-live wb-live-sm"><span class="wb-live-dot"></span>LIVE</span>' : ""
          }</p>
          <p class="wb-other-name">${["Havertz", "Cunha", "Haaland", "Mbeumo"][i]}</p>
          <div class="wb-other-foot">
            <p class="wb-other-club">${box("12px", "12px")}MUN · ×2</p>
            <span class="wb-other-points">+2</span>
          </div>
        </div></div>`,
    )
    .join("");

  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}:root{--font-archivo:system-ui}body{margin:0}</style></head><body>
<header style="position:sticky;top:0;background:var(--color-bg)">
  <div class="wb-page" style="padding:14px 24px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
      <span style="font-family:var(--font-heading);font-weight:800;font-size:20px">WINGBACK</span>
      <div style="display:flex;gap:8px;flex:none">
        <button class="btn btn-secondary wb-bell">🔔</button>
        <button class="btn btn-secondary" style="padding:8px 10px">≡</button>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
      <span style="background:var(--color-text);color:var(--color-bg);font-weight:800;font-size:11px;padding:3px 8px">GW 2</span>
      <span style="background:var(--color-closed);color:#fff;font-weight:800;font-size:11px;padding:3px 8px">LOCKED</span>
      <span style="font-size:13px">picks are in</span>
    </div>
  </div>
  <div style="border-top:2px solid var(--color-divider);border-bottom:2px solid var(--color-divider)">
    <div class="wb-page wb-standings">${standings}</div>
  </div>
</header>
<main class="wb-page" style="padding:20px 24px 64px">
  <h1 style="margin:0;font-size:22px">Gameweek 2</h1>
  <div class="wb-home-split">
    <section class="wb-home-split-left">
      <h6>Your pick</h6>
      <div class="wb-pickform"><div class="wb-picker">
        <div class="wb-picker-search"><input class="input wb-picker-input" placeholder="Search player or team">
          <button class="btn btn-ghost wb-picker-cancel">Cancel</button></div>
        <div class="wb-chips">${chips}</div>
        <div class="wb-picker-meta"><span class="wb-picker-fixture">Arsenal · ARS v AVL · Sat 15:00</span>
          <span class="wb-picker-synced">refreshed 2h ago</span></div>
        <div class="wb-picker-results">${players}</div>
      </div></div>
    </section>
    <section class="wb-home-split-right">
      <h6>The other four</h6>
      <div class="wb-others">${others}</div>
    </section>
  </div>
</main></body></html>`;
}

let browser: Browser;

beforeAll(async () => {
  // PLAYWRIGHT_BROWSERS_PATH is set in CI and in the dev container; letting
  // playwright resolve it itself keeps this working in both.
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

describe("home, with the picker open", () => {
  for (const width of WIDTHS) {
    it(`does not scroll sideways at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await page.setContent(homePage());

      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth - de.clientWidth;
      });

      await context.close();
      expect(overflow).toBe(0);
    });
  }

  it("keeps the standings strip scrollable to its last entry", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await context.newPage();
    await page.setContent(homePage());

    const clear = await page.evaluate(() => {
      const strip = document.querySelector(".wb-standings") as HTMLElement;
      const cells = [...strip.querySelectorAll(".wb-standing")];
      strip.scrollLeft = strip.scrollWidth;
      // Positive means the fifth entrant can be brought fully into view —
      // the half of the bug where they could not.
      return strip.getBoundingClientRect().right - cells.at(-1)!.getBoundingClientRect().right;
    });

    await context.close();
    expect(clear).toBeGreaterThanOrEqual(0);
  });

  it("gives the chip row a width that tracks the viewport", async () => {
    // The regression: the chip row reported 560px at every viewport, because
    // a bare `1fr` track could not shrink below its content.
    const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await context.newPage();
    await page.setContent(homePage());

    const chipWidth = await page.evaluate(
      () => (document.querySelector(".wb-chips") as HTMLElement).clientWidth,
    );

    await context.close();
    expect(chipWidth).toBeLessThan(390);
  });
});

/** The sign-in screen, in the state everyone meets it in: signed out, one
 * email field. Two things broke here and both are asserted below. */
function loginPage(): string {
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}:root{--font-archivo:system-ui}body{margin:0}</style></head><body>
<main class="wb-login-page">
  <div class="wb-login-hero">
    <svg class="wb-login-hero-pitch" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg>
    <span class="wb-login-wordmark">WINGBACK</span>
    <p class="wb-login-tagline">The gang&rsquo;s Premier League goalscorer sweepstake.</p>
    <p class="wb-login-names">Nick · Tom · Alex · Henry · Casra</p>
  </div>
  <div class="wb-login-form-panel">
    <div class="wb-login-form-inner">
      <h6 style="margin:0 0 16px">Sign in</h6>
      <form class="wb-login-step">
        <p class="wb-login-hint">Sign in with your email — no password needed.</p>
        <div class="field"><label for="wb-email">Email</label>
          <input id="wb-email" class="input" type="email" placeholder="you@example.com"></div>
        <button type="submit" class="btn btn-primary wb-tap wb-login-submit">Email me a link</button>
      </form>
    </div>
  </div>
</main></body></html>`;
}

describe("sign in", () => {
  for (const { width, height, usable } of PHONES) {
    it(`puts the whole form above the fold at ${width}×${height}`, async () => {
      // The hero used to fill the screen: the email field landed at y≈635 on a
      // 390-wide phone and y≈641 on an SE, so you arrived at a green wall and
      // had to scroll to reach the only control on the page.
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      await page.setContent(loginPage());

      const bottom = await page.evaluate(
        () => document.querySelector(".wb-login-submit")!.getBoundingClientRect().bottom,
      );

      await context.close();
      expect(bottom).toBeLessThanOrEqual(usable);
    });
  }

  it("gives touch devices a 16px field, so iOS doesn't zoom the page on focus", async () => {
    // Under 16px, Safari zooms in on focus and the layout viewport ends up
    // wider than the screen — which is felt as the field flying off the side.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.setContent(loginPage());

    const size = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector(".input")!).fontSize),
    );

    await context.close();
    expect(size).toBeGreaterThanOrEqual(16);
  });

  it("does not scroll sideways at any width", async () => {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await page.setContent(loginPage());
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await context.close();
      expect(overflow, `at ${width}px`).toBe(0);
    }
  });
});
