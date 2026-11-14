// Screenshots requested on Nov 14: error messages 4, 5, 9, 10, lead flow screens and the success
// screen, at 390x844 and 1536x730. Formspree is intercepted here (nothing real is sent).
// Usage: node qa/scripts/shots-nov14.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { BASE, EXE, SHOTS, answerFlow } from './qa-lib.mjs';

const OUT = `${SHOTS}/nov14`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE.chromium });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function toQuestion(page, before) {
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.choices2 .tile').first().click();
  await page.waitForSelector('.pain');
  await sleep(400);
  await page.locator('.pain').nth(1).click();
  await page.locator('.q__next').click();
  for (const v of before) {
    await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
    await page.keyboard.type(v, { delay: 5 });
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
}
async function showMessage(page, value, file) {
  await page.keyboard.type(value, { delay: 5 });
  await page.locator('.nq__input').blur();
  await sleep(300);
  await page.evaluate(() => {
    const q = document.querySelector('.q');
    const y = q.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64) - 8;
    window.scrollTo(0, y);
  });
  await sleep(400);
  await page.screenshot({ path: `${OUT}/${file}` });
}

for (const vp of [{ width: 390, height: 844 }, { width: 1536, height: 730 }]) {
  const tag = `${vp.width}x${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, isMobile: vp.width < 500, hasTouch: vp.width < 500, reducedMotion: 'reduce' });
  await ctx.route('**/formspree.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();

  await toQuestion(page, ['75000', '35000']);
  await showMessage(page, '64000', `${tag}-error4-payments-160pct.png`);
  await toQuestion(page, ['75000', '35000']);
  await showMessage(page, '50000', `${tag}-note5-payments-125pct.png`);
  await toQuestion(page, ['300000', '120000', '166500', '1500', '180']);
  await showMessage(page, '1400', `${tag}-error9-denied-plus-firstpass.png`);
  await toQuestion(page, ['300000', '120000', '166500', '1500', '180', '1260', '190000']);
  await showMessage(page, '200000', `${tag}-error10-ar90-over-total.png`);

  // Lead flow
  await answerFlow(page, { specialty: 'behavioral', values: ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'], pains: [0, 1] });
  await page.locator('#offer-cta').click();
  await sleep(900);
  const shot = async (name) => {
    await page.evaluate(() => {
      const el = document.getElementById('lead');
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - bar - 8);
    });
    await sleep(500);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  };
  const tap = async (label) => {
    await page.locator('.lf__tile', { hasText: label }).first().click();
    await sleep(450);
  };
  await shot('lead1-billing');
  await tap('An outside billing company');
  await tap('2 to 5');
  await shot('lead3-software');
  await tap('TherapyNotes');
  await tap('As soon as possible');
  await shot('lead5-review');
  await tap('Yes, attach my scorecard');
  await tap('Call me');
  await shot('lead6-contact');
  await page.locator('.lf__continue').click();
  await sleep(400);
  await page.locator('#lead input[autocomplete=name]').fill('Dana Reyes');
  await page.locator('#lead input[autocomplete=organization]').fill('Harbor Behavioral Health');
  await page.locator('#lead input[type=email]').fill('dana@harborbh.com');
  await page.locator('#lead input[type=tel]').focus();
  await shot('lead7-details');
  await page.keyboard.type('8435550142');
  await page.locator('.lf__send').click();
  await page.waitForSelector('.lf--done');
  await page.waitForFunction(() => document.querySelector("iframe.lf__booking"));
  await sleep(9000); // let the calendar load
  await shot('success');
  await ctx.close();
  console.log('done', tag);
}
await browser.close();
