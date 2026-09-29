import { readFileSync } from "node:fs";
import { chromium, type Browser, type BrowserContext } from "playwright";
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

/** What Skeleton.tsx's SkelBlock renders. */
const skel = (w: number, h: number) =>
  `<span class="wb-skel" style="display:block;flex:none;width:${w}px;height:${h}px"></span>`;

const HEAD = `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}:root{--font-archivo:system-ui}body{margin:0}</style></head><body>`;

const STANDINGS = ["Nick", "Tom", "Alex", "Henry", "Casra"]
  .map(
    (name, i) => `<button class="wb-standing${i === 0 ? " wb-standing-me" : ""}">
      <span class="wb-standing-rank">0${i + 1}</span>${box("24px", "24px")}
      <span class="wb-standing-who"><span class="wb-standing-name">${name}</span>
      <span class="wb-standing-stars">★★</span></span>
      <span class="wb-standing-points">12</span></button>`,
  )
  .join("");

/** The header as Header.tsx renders it, in the two states it spends the
 * season in. Same classes as the component: that is the whole point of the
 * height comparison below. */
function header(state: "open" | "locked"): string {
  const gw =
    state === "open"
      ? `<span class="wb-header-badge">GW 2</span>
         <span class="wb-header-status">locks in <span class="wb-header-countdown">2d 4h 12m</span></span>`
      : `<span class="wb-header-badge">GW 2</span>
         <span class="wb-header-badge wb-header-badge-locked">LOCKED</span>
         <span class="wb-header-status">picks are in</span>`;
  return `<header class="wb-header">
  <div class="wb-page wb-header-bar">
    <div class="wb-header-row">
      <a class="wb-wordmark" href="/">WINGBACK</a>
      <div class="wb-header-actions">
        <button class="btn btn-secondary wb-tap btn-icon wb-bell" aria-label="Alerts"><svg width="16" height="17" viewBox="0 0 16 17"></svg></button>
        <button class="btn btn-secondary wb-tap btn-icon" aria-label="Menu"><svg width="18" height="14" viewBox="0 0 18 14"></svg></button>
      </div>
    </div>
    <div class="wb-header-gw">${gw}</div>
  </div>
  <div class="wb-header-standings"><div class="wb-page wb-standings">${STANDINGS}</div></div>
</header>`;
}

/** HeaderSkeleton in Skeleton.tsx, block for block. */
function headerSkeleton(): string {
  const rows = [0, 1, 2, 3, 4]
    .map(
      () => `<span class="wb-standing" style="cursor:default">${skel(14, 10)}${skel(24, 24)}${skel(48, 13)}${skel(22, 22)}</span>`,
    )
    .join("");
  return `<header class="wb-header" aria-busy="true">
  <div class="wb-page wb-header-bar">
    <div class="wb-header-row">
      ${skel(112, 20)}
      <div class="wb-header-actions">
        <span class="wb-skel btn-icon" style="display:block"></span>
        <span class="wb-skel wb-skel-2 btn-icon" style="display:block"></span>
      </div>
    </div>
    <div class="wb-header-gw">${skel(44, 23)}${skel(120, 13)}</div>
  </div>
  <div class="wb-header-standings"><div class="wb-page wb-standings">${rows}</div></div>
</header>`;
}

/** The menu drawer and the alerts panel, open — the two dialogs, with the
 * close buttons that used to be 22px tall. */
function overlays(): string {
  return `${HEAD}${header("open")}
<div class="wb-scrim" aria-hidden="true"></div>
<div class="wb-drawer" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="wb-drawer-head"><span class="wb-drawer-title">Menu</span>
    <button class="btn btn-ghost wb-tap btn-icon" aria-label="Close menu"><svg width="14" height="14"></svg></button></div>
  <nav style="display:flex;flex-direction:column">
    <a class="wb-drawer-item" href="/" aria-current="page">Home</a>
    <a class="wb-drawer-item" href="/leaderboard">The table</a>
    <a class="wb-drawer-item" href="/settings">Settings</a>
  </nav>
  <button class="wb-drawer-item wb-drawer-signout">Sign out</button>
</div>
<div class="wb-alerts-panel" role="dialog" aria-modal="true" aria-label="Alerts" style="left:0;width:100%">
  <div class="wb-drawer-head"><span class="wb-drawer-title">Alerts</span>
    <button class="btn btn-ghost wb-tap btn-icon" aria-label="Close alerts"><svg width="14" height="14"></svg></button></div>
</div>
</body></html>`;
}

/** The Settings controls with the smallest natural boxes: the theme switch
 * and the phone form. */
function settingsPage(): string {
  return `${HEAD}${header("locked")}
<main class="wb-in" style="width:100%;max-width:720px;margin:0 auto;padding:32px 24px 64px">
  <div class="wb-seg" role="group" aria-label="Theme">
    <button class="wb-seg-btn" aria-pressed="false">Light</button>
    <button class="wb-seg-btn" aria-pressed="false">Dark</button>
    <button class="wb-seg-btn" aria-pressed="true">Auto</button>
  </div>
  <form class="wb-alert-phone">
    <div class="field" style="flex:1;min-width:0"><label for="p">Mobile number</label><input id="p" class="input" type="tel"></div>
    <button type="submit" class="btn btn-secondary wb-tap">Save</button>
  </form>
</main></body></html>`;
}

/** Home, with the picker open over a club's squad — the state that broke. */
function homePage(): string {
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

  return `${HEAD.replace('data-theme="light"', 'data-theme="dark"')}
${header("locked")}
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
      <div class="wb-pickform"><div class="wb-pick-card">
        <div class="wb-pick-photo"></div>
        <div class="wb-pick-detail">
          <p class="wb-pick-name">Gyökeres</p>
          <p class="wb-pick-fixture">Arsenal v Aston Villa · Sat 15:00</p>
          <div class="wb-pick-controls">
            <span class="wb-pick-label">Player</span>
            <span><button type="button" class="wb-control wb-tap">Change</button></span>
            <span class="wb-pick-label">Stake</span>
            <span class="wb-control-group" role="group" aria-label="Stake">
              <button type="button" class="wb-control wb-tap" aria-pressed="true">£3</button>
              <button type="button" class="wb-control wb-tap" aria-pressed="false">£6</button>
            </span>
          </div>
        </div>
      </div></div>
    </section>
    <section class="wb-home-split-right">
      <h6>The other four</h6>
      <div class="wb-others">${others}</div>
    </section>
  </div>
  <section class="wb-team-sheet">
    <div class="wb-team-sheet-head">
      <h6 style="margin:0">Team of the week</h6>
      <span class="wb-team-sheet-note">Gameweek 2 is locked</span>
      <button type="button" class="wb-team-sheet-dismiss wb-tap" aria-label="Hide the team sheet">✕</button>
    </div>
  </section>
  <div class="wb-fixture-days">
    <details class="wb-fixture-day" open>
      <summary class="wb-fixture-day-head"><span class="wb-chev">▶</span>
        <span class="wb-fixture-day-label">Saturday</span><span style="font-size:11px">6 matches · 2 picked</span></summary>
      <div class="wb-fixture-row"><span class="wb-fixture-time">15:00</span>
        <span class="wb-fixture-match">Arsenal <span>v</span> Aston Villa</span></div>
    </details>
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

/** The table, with the prize pot breakdown above it — the three-column
 * split is the piece most likely to force the page wider than the phone,
 * so a long entrant name is deliberately used here rather than "Nick". */
function leaderboardPage(): string {
  const rows = ["Christopher-Alexander", "Bartholomew", "Alex", "Henry", "Casra"]
    .map(
      (name, i) => `<button type="button" class="wb-row wb-board-row" aria-expanded="${i === 0}" aria-controls="panel-${i}"
        aria-label="${name}, ${i + 1}, 12 points, 3 scoring GWs. Season record">
        <span class="wb-board-rank">${i + 1}</span>${box("32px", "32px")}
        <span class="wb-board-name">${name}</span><span class="wb-board-points">12</span>
        <span class="wb-board-chev" aria-hidden="true">▼</span>
        <span class="wb-board-meta">3 scoring GWs · leads by 4</span></button>`,
    )
    .join("");
  return `${HEAD}${header("open")}
<main class="wb-in wb-page" style="padding:32px 24px 64px">
  <h1 style="margin:0;font-size:22px">The table</h1>
  <div>${rows}</div>
  <div class="wb-prize">
    <div class="wb-prize-head">
      <div>
        <p class="wb-prize-label">Prize pot</p>
        <p class="wb-prize-pot">£60.00</p>
      </div>
      <p class="wb-prize-sub">£3 a gameweek per entrant, £6 when they double — 3 gameweeks locked in so far, whether or not everyone picked.</p>
    </div>
    <div class="wb-prize-splits">
      <div class="wb-prize-split">
        <p class="wb-prize-split-label">Winner · 60%</p>
        <p class="wb-prize-split-amount">£36.00</p>
        <p class="wb-prize-split-who">Christopher-Alexander, if it ended today</p>
      </div>
      <div class="wb-prize-split">
        <p class="wb-prize-split-label">Runner-up · 25%</p>
        <p class="wb-prize-split-amount">£15.00</p>
        <p class="wb-prize-split-who">Bartholomew, if it ended today</p>
      </div>
      <div class="wb-prize-split">
        <p class="wb-prize-split-label">Shared pot · 15%</p>
        <p class="wb-prize-split-amount">£9.00</p>
        <p class="wb-prize-split-who">£1.80 each, everyone</p>
      </div>
    </div>
  </div>
</main></body></html>`;
}

describe("the table, with the prize pot breakdown", () => {
  for (const width of WIDTHS) {
    it(`does not scroll sideways at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await page.setContent(leaderboardPage());

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      await context.close();
      expect(overflow, `at ${width}px`).toBe(0);
    });
  }
});

// A phone as Playwright emulates one: touch, mobile viewport — which is what
// makes `(pointer: coarse)` match, and so what every 44px rule hangs off.
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

/** Every tappable thing on the page, with its box. Hidden ones (a collapsed
 * <details>, say) are left out: they have no box to measure. */
const TARGETS = `button, [role="button"], a.btn, a.wb-drawer-item, summary`;
async function measureTargets(html: string, context: BrowserContext) {
  const page = await context.newPage();
  await page.setContent(html);
  return page.evaluate((selector) => {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const boxes = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          what: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? el.className,
          width: r.width,
          height: r.height,
        };
      });
    return { coarse, boxes };
  }, TARGETS);
}

describe("touch targets", () => {
  // 44pt is the smallest thing a thumb reliably lands on. The header icons
  // were 36, the drawer's close button 22, the stake toggle 30, a fixture
  // day's summary 33 and the team-sheet's ✕ 27 — each fine under a mouse
  // and a miss under a finger.
  for (const [name, html] of [
    ["home", homePage()],
    ["the table", leaderboardPage()],
    ["the drawer and alerts panel", overlays()],
    ["settings", settingsPage()],
  ] as const) {
    it(`gives every control on ${name} a 44×44 box under a finger`, async () => {
      const context = await browser.newContext(PHONE);
      const { coarse, boxes } = await measureTargets(html, context);
      await context.close();

      expect(coarse, "the touch emulation must actually engage (pointer: coarse)").toBe(true);
      expect(boxes.length).toBeGreaterThan(3);
      const short = boxes.filter((b) => b.width < 44 || b.height < 44);
      expect(short, JSON.stringify(short)).toEqual([]);
    });
  }

  it("keeps the fine-pointer sizes for a mouse", async () => {
    // The check above is only worth anything if the sizes really are
    // conditional — otherwise it would pass because everything grew.
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const page = await context.newPage();
    await page.setContent(homePage());
    const icon = await page.evaluate(
      () => document.querySelector(".btn-icon")!.getBoundingClientRect().height,
    );
    await context.close();
    expect(icon).toBe(36);
  });

  it("still fits the header on an SE with the bigger buttons", async () => {
    const context = await browser.newContext({ ...PHONE, viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    await page.setContent(homePage());
    const { overflow, wrapped } = await page.evaluate(() => {
      const de = document.documentElement;
      const mark = document.querySelector(".wb-wordmark")!.getBoundingClientRect();
      const bell = document.querySelector(".wb-bell")!.getBoundingClientRect();
      // Same line: the wordmark and the buttons must not have stacked.
      return { overflow: de.scrollWidth - de.clientWidth, wrapped: bell.top >= mark.bottom };
    });
    await context.close();
    expect(overflow).toBe(0);
    expect(wrapped).toBe(false);
  });
});

describe("the header skeleton", () => {
  // Nav sits behind a Suspense boundary in layout.tsx, so the header the
  // page first paints with is the skeleton. If its height differs from the
  // real header's, the whole page jumps when Nav resolves — under a mouse
  // and under a finger, where the icon buttons are a different size.
  for (const [pointer, options] of [
    ["mouse", { viewport: { width: 390, height: 844 } }],
    ["finger", PHONE],
  ] as const) {
    for (const state of ["open", "locked"] as const) {
      it(`is the height of the real header (${state}) under a ${pointer}`, async () => {
        const context = await browser.newContext(options);
        const heights: number[] = [];
        for (const markup of [header(state), headerSkeleton()]) {
          const page = await context.newPage();
          await page.setContent(`${HEAD}${markup}</body></html>`);
          heights.push(
            await page.evaluate(() => document.querySelector(".wb-header")!.getBoundingClientRect().height),
          );
        }
        await context.close();
        expect(heights[1]).toBe(heights[0]);
      });
    }
  }
});

describe("safe areas", () => {
  // Chromium can't be told it has a notch, so env() reads 0 here whatever
  // the stylesheet says. What can be pinned is the wiring: without
  // viewport-fit=cover every env(safe-area-inset-*) is 0 on the phone too,
  // and that was the state the app shipped in.
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  it("asks for viewport-fit=cover from the viewport export", () => {
    expect(layout).toMatch(/export const viewport: Viewport = \{[\s\S]*viewportFit: "cover"/);
  });

  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  };

  it("keeps the sticky header below the status bar", () => {
    expect(rule(".wb-header")).toMatch(/padding-top: env\(safe-area-inset-top\)/);
  });

  it("keeps the toasts above the home indicator", () => {
    expect(rule(".wb-toasts")).toMatch(/bottom: calc\(24px \+ env\(safe-area-inset-bottom\)\)/);
  });

  it("keeps the page out from under the camera in landscape", () => {
    expect(rule("body")).toMatch(/padding-left: env\(safe-area-inset-left\)/);
    expect(rule("body")).toMatch(/padding-right: env\(safe-area-inset-right\)/);
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

/** The team sheet card on home, once a gameweek has locked. The image the
 * compositor produces is intrinsically 1200×530 — much wider than a phone —
 * so the thing actually worth pinning here is that .wb-team-sheet-img's
 * width:100% keeps it from ever being the thing that forces the page wide,
 * even before it has loaded (the src 404s in this fixture on purpose; the
 * reserved aspect-ratio box is what's under test, not the network). */
function teamSheetCard(): string {
  return `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${css}:root{--font-archivo:system-ui}body{margin:0}</style></head><body>
<main class="wb-in wb-page" style="padding:20px 24px 64px">
  <section class="wb-team-sheet">
    <div class="wb-team-sheet-head">
      <h6 style="margin:0">Team of the week</h6>
      <span class="wb-team-sheet-note">Gameweek 4 is locked — share the five picks</span>
    </div>
    <img class="wb-team-sheet-img" src="/api/team-sheet/4" alt="Gameweek 4 team sheet">
    <button type="button" class="btn btn-primary wb-tap">Share to WhatsApp</button>
  </section>
</main></body></html>`;
}

describe("team of the week card", () => {
  for (const width of WIDTHS) {
    it(`does not scroll sideways at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await page.setContent(teamSheetCard());

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      await context.close();
      expect(overflow, `at ${width}px`).toBe(0);
    });
  }

  it("never renders the image wider than the viewport", async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const page = await context.newPage();
    await page.setContent(teamSheetCard());

    const imgWidth = await page.evaluate(
      () => document.querySelector(".wb-team-sheet-img")!.getBoundingClientRect().width,
    );

    await context.close();
    expect(imgWidth).toBeLessThanOrEqual(320);
  });
});
