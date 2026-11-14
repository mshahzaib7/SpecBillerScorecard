// Proves the legacy-CSS build step (build/legacyCss.ts) changes nothing visible in a modern browser:
// the same pages are screenshotted from the normal build (5391, layers flattened) and from a build
// without the step (5392, layers kept), then compared pixel by pixel.
// Usage: node qa/scripts/qa-css-flatten.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { EXE } from './qa-lib.mjs';

const G1 = ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'];
const browser = await chromium.launch({ executablePath: EXE.chromium });

async function shots(base, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const out = {};
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  out.home = await page.screenshot({ fullPage: true });
  // Results page (the same answers typed in both builds)
  await page.locator('.hero__start').click();
  await page.waitForTimeout(400);
  await page.locator('.tile').nth(0).click();
  await page.waitForSelector('.pain');
  await page.waitForTimeout(400);
  await page.locator('.q__next').click();
  for (const v of G1) {
    await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
    await page.keyboard.type(v);
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.reveal2', { state: 'attached' });
  await page.locator('.reveal2__skip').click();
  await page.waitForSelector('.reveal2', { state: 'detached' });
  await page.locator('#offer-cta').click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  out.results = await page.screenshot({ fullPage: true });
  await ctx.close();
  return out;
}

const report = [];
for (const viewport of [{ width: 390, height: 844 }, { width: 1536, height: 730 }]) {
  const a = await shots('http://localhost:5391/', viewport);
  const b = await shots('http://localhost:5392/', viewport);
  for (const k of Object.keys(a)) {
    const same = Buffer.compare(a[k], b[k]) === 0;
    let diff = null;
    if (!same) {
      // Count differing pixels by decoding both in the page (PNG → canvas).
      const p = await browser.newPage();
      diff = await p.evaluate(
        async ([x, y]) => {
          const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
          const [ia, ib] = await Promise.all([load(x), load(y)]);
          if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
          const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height;
          const g = c.getContext('2d');
          g.drawImage(ia, 0, 0); const da = g.getImageData(0, 0, c.width, c.height).data;
          g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const db = g.getImageData(0, 0, c.width, c.height).data;
          let n = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) n++;
          return { pixels: n, of: c.width * c.height };
        },
        [a[k].toString('base64'), b[k].toString('base64')],
      );
      await p.close();
    }
    const row = { viewport: `${viewport.width}x${viewport.height}`, page: k, identical: same, diff };
    report.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync('c:/Spec Biller Scorecard/qa/results-css-flatten.json', JSON.stringify(report, null, 2));
await browser.close();
