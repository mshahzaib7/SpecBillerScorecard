// Screens for the "What practice owners told us" section, plus a no-sideways-scroll check at 5 widths.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { EXE, SHOTS } from './qa-lib.mjs';

const BASE = 'http://localhost:5391/';
const out = `${SHOTS}/proof`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE.chromium });
for (const [w, h] of [[360, 780], [390, 844], [834, 1112], [1536, 730], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const sec = page.locator('.proof');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.proof img')].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = r))))));
  const info = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('body section, body main')].slice(0, 5).map((s) => s.className.split(' ')[0]);
    return { overflowX: document.documentElement.scrollWidth - innerWidth, order: ids, imgs: [...document.querySelectorAll('.proof img')].map((i) => i.naturalWidth) };
  });
  console.log(w, JSON.stringify(info));
  if (w === 390 || w === 1536) {
    await page.locator('.proof').screenshot({ path: `${out}/${w}x${h}-proof.png` });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${w}x${h}-top.png` });
  }
  await page.close();
}
await browser.close();
