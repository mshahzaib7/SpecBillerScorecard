// Animation QA (Nov 14 brief, Part 4): which animations run on each phone, with reduced motion off/on
// and with a 4x slower CPU, plus the "animation code is slow or fails" safety net.
// Usage: node qa/scripts/qa-motion.mjs
import { chromium, webkit } from 'playwright';
import { writeFileSync } from 'fs';
import { BASE, EXE } from './qa-lib.mjs';

const G1 = ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'];
const DEVICES = [
  { name: 'WebKit 390x844', engine: 'webkit', viewport: { width: 390, height: 844 } },
  { name: 'WebKit 375x667', engine: 'webkit', viewport: { width: 375, height: 667 } },
  { name: 'Chromium 360x800', engine: 'chromium', viewport: { width: 360, height: 800 } },
];
const browsers = { chromium: await chromium.launch({ executablePath: EXE.chromium }), webkit: await webkit.launch() };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 4x CPU slowdown. Chromium: the DevTools CPU throttle (rate 4). WebKit has no CPU throttle in
 * Playwright, so the page's main thread is kept busy 75% of the time instead (a busy loop of
 * 12 ms in every 16 ms), which slows script and rendering by about 4x.
 */
async function slowDown(page, engine) {
  if (engine === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    return 'DevTools CPU throttle x4';
  }
  await page.addInitScript(() => {
    setInterval(() => {
      const end = performance.now() + 12;
      while (performance.now() < end) {
        /* busy */
      }
    }, 16);
  });
  return 'main thread kept 75% busy (WebKit has no CPU throttle)';
}

/** Distinct values of `sel`'s text over `ms`. */
async function sample(page, sel, ms, every = 150) {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await page.locator(sel).first().textContent().catch(() => null);
    if (v !== null && seen[seen.length - 1] !== v) seen.push(v);
    await sleep(every);
  }
  return seen;
}
const animNames = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? el.getAnimations({ subtree: true }).map((a) => a.animationName ?? a.constructor.name) : null;
  }, sel);

async function runCase(dev, reduced, slow) {
  const ctx = await browsers[dev.engine].newContext({
    viewport: dev.viewport,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    isMobile: dev.engine === 'chromium',
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__vibrations = 0;
    try {
      Object.defineProperty(navigator, 'vibrate', { value: () => (window.__vibrations++, true), configurable: true });
    } catch {}
  });
  const slowNote = slow ? await slowDown(page, dev.engine) : 'none';
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const r = { device: dev.name, reducedMotion: reduced ? 'ON' : 'OFF', cpu: slow ? '4x slower' : 'normal', slowdown: slowNote };

  await page.goto(BASE);
  r.requestIdleCallback = await page.evaluate(() => typeof window.requestIdleCallback === 'function');
  // 1. Hero demo
  const hero = await sample(page, '.sheet__total-figure', slow ? 8000 : 6500);
  r.heroDemo = hero.length > 2 ? `loops (${hero.length} values in ${slow ? 8 : 6.5}s)` : `still on first frame (${hero[0]})`;
  r.heroButton = (await page.locator('.sheet__pause').textContent())?.trim();
  if (reduced) {
    await page.locator('.sheet__pause').click();
    const played = await sample(page, '.sheet__total-figure', slow ? 10000 : 7500);
    const after = (await page.locator('.sheet__pause').textContent())?.trim();
    r.heroPlayDemo = `${played.length} values, ends on ${played[played.length - 1]} (first frame ${hero[0]}), button back to "${after}"`;
  }
  r.motionCode = (await page.evaluate(() => document.documentElement.classList.contains('motion-off'))) ? 'gave up (plain mode)' : 'loaded';

  // 2. Question flow: specialty, pains, then 8 numbers; watch one question change and the live statement
  await page.locator('.hero__start').click();
  await sleep(500);
  await page.locator('.choices2 .tile').first().click();
  await page.waitForSelector('.pain');
  await sleep(400);
  await page.locator('.q__next').click();
  let qStyle = null;
  let lineAnim = null;
  for (const [i, v] of G1.entries()) {
    await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '', null, { timeout: 30000 });
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
    if (i === 0) {
      await sleep(60);
      qStyle = await page.locator('.q__body').first().getAttribute('style');
      lineAnim = await page.locator('.stmt__line').first().getAttribute('style');
    }
  }
  r.questionChange = qStyle ? `framer (${qStyle.includes('translate') ? 'fade + slide' : 'fade only'})` : 'plain (no animation)';
  r.statementLine = lineAnim ? `framer (${/translate/.test(lineAnim) ? 'fade + slide' : 'fade only'})` : 'plain';

  // 3. Reveal: sheet, count-up, grade landing, vibration
  await page.waitForSelector('.reveal2', { state: 'attached', timeout: 30000 });
  r.revealSheet = (await animNames(page, '.reveal2__sheet'))?.join(',') || 'none';
  const money = await sample(page, '.reveal2__money', slow ? 2600 : 1900, 60);
  r.revealCount = `${money.length} values (${money[0]} → ${money[money.length - 1]})`;
  r.gradeLanding = (await animNames(page, '.reveal2__letter'))?.join(',') || 'done before sampled';
  await page.waitForSelector('.reveal2', { state: 'detached', timeout: 20000 });
  r.vibrations = await page.evaluate(() => window.__vibrations);

  // 4. Scroll the results: every fade-in must end visible
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += Math.round(dev.viewport.height * 0.7)) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(slow ? 350 : 200);
  }
  await sleep(1200);
  r.fadeUps = await page.evaluate(() => ({
    faded: document.querySelectorAll('.fadeup--in').length,
    stillHidden: document.querySelectorAll('.fadeup--wait').length,
    shownAtOnce: document.querySelectorAll('.fadeup:not(.fadeup--in):not(.fadeup--wait)').length,
  }));
  r.marker = (await page.locator('.strack__marker').first().getAttribute('style')) ?? '';
  r.marker = /opacity: 1/.test(r.marker) ? (r.marker.includes('scale') || /transform: none/.test(r.marker) ? 'framer, visible' : 'framer, visible') : /opacity/.test(r.marker) ? `framer, NOT visible (${r.marker})` : 'plain, visible';

  // 5. Lead flow screen change
  await page.locator('#offer-cta').click();
  await sleep(800);
  await page.locator('.lf__tile').first().click();
  await sleep(320);
  r.leadScreen = (await animNames(page, '.lf__screen'))?.join(',') || 'none (already done)';

  // 6. Nothing invisible
  r.invisible = await page.evaluate(() =>
    [...document.querySelectorAll('main .fadeup, .q__body, .stmt__line, .lf__screen, .sheet, .verdict, .ledger__row, .srow')]
      .filter((e) => {
        let el = e;
        while (el && el !== document.body) {
          if (parseFloat(getComputedStyle(el).opacity) < 0.05) return true;
          el = el.parentElement;
        }
        return false;
      })
      .map((e) => e.className),
  );
  r.errors = errors;
  await ctx.close();
  return r;
}

const rows = [];
for (const dev of DEVICES) {
  for (const reduced of [false, true]) {
    for (const slow of [false, true]) {
      const r = await runCase(dev, reduced, slow);
      rows.push(r);
      console.log(JSON.stringify(r));
    }
  }
}

/* Safety net: animation code slow (3 s) or blocked. Content must be visible within 1 s and stay visible. */
const net = [];
for (const [label, handler] of [
  ['blocked', (route) => route.abort('failed')],
  ['3 s late', async (route) => { await sleep(3000); await route.continue(); }],
]) {
  for (const engine of ['webkit', 'chromium']) {
    const ctx = await browsers[engine].newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.route('**/motionFeatures-*.js', handler);
    const t0 = Date.now();
    await page.goto(BASE);
    await page.waitForFunction(() => document.documentElement.classList.contains('motion-off'), null, { timeout: 5000 }).catch(() => null);
    const gaveUpAfter = Date.now() - t0;
    await page.locator('.hero__start').click();
    await sleep(500);
    await page.locator('.choices2 .tile').first().click();
    await page.waitForSelector('.pain');
    await sleep(400);
    await page.locator('.q__next').click();
    await sleep(500);
    const vis = await page.evaluate(() => {
      const t = document.querySelector('.q__title');
      const b = document.querySelector('.q__body');
      return { title: t?.textContent, opacity: b ? getComputedStyle(b).opacity : null, bodies: document.querySelectorAll('.q__body').length };
    });
    await sleep(3500); // let the late chunk arrive: nothing should switch or hide
    const later = await page.evaluate(() => ({ off: document.documentElement.classList.contains('motion-off'), opacity: getComputedStyle(document.querySelector('.q__body')).opacity, bodies: document.querySelectorAll('.q__body').length }));
    const row = { case: `animation code ${label}`, engine, plainModeWithin: `${gaveUpAfter} ms`, question: vis.title, opacity: vis.opacity, questionBodies: vis.bodies, after4s: later };
    net.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
}

writeFileSync('c:/Spec Biller Scorecard/qa/results-motion.json', JSON.stringify({ rows, safetyNet: net }, null, 2));
await browsers.chromium.close();
await browsers.webkit.close();
