// QA section F: collect every piece of visible text across the site's states.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { BASE, EXE } from './qa-lib.mjs';

const browser = await chromium.launch({ executablePath: EXE.chromium });
const texts = new Set();
const grab = async (page) => {
  const t = await page.evaluate(() => {
    // Visible text plus attributes visitors or screen readers get.
    const attrs = [...document.querySelectorAll('[aria-label],[placeholder],[title],[alt],[aria-valuetext]')].flatMap((e) => ['aria-label', 'placeholder', 'title', 'alt', 'aria-valuetext'].map((a) => e.getAttribute(a)).filter(Boolean));
    return [document.body.innerText, document.title, ...attrs].join('\n');
  });
  t.split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => texts.add(s));
};

async function runCase(spec, values, attorney, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/assets/*.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: (await res.text()).replace('https://formspree.io/f/xpppgarr', 'https://lead.example.test/submit') });
  });
  await ctx.route('https://lead.example.test/submit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } }));
  await ctx.route('https://calendly.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  await page.goto(BASE); await page.waitForTimeout(300); await grab(page);
  await page.locator('.tile').nth(spec).click(); await page.waitForSelector('.pain'); await page.waitForTimeout(400);
  await grab(page);
  await page.locator('.pain').nth(0).click(); await page.locator('.pain').nth(3).click();
  await page.locator('.q__next').click();
  let i = 0;
  while (i < values.length) {
    await page.waitForFunction(() => document.querySelector('.choices2') || document.activeElement?.classList.contains('nq__input'));
    if (await page.locator('.choices2').count()) { await grab(page); await page.locator('.choices2 .tile').nth(attorney ? 0 : 1).click(); await page.waitForFunction(() => !document.querySelector('.choices2')); continue; }
    // empty Next once to capture the message, then "Where's this?"
    if (i === 0) { await page.locator('.q__next').click(); await page.waitForTimeout(200); await grab(page); }
    await page.locator('.nq__where').click(); await page.waitForTimeout(200); await grab(page);
    const v = values[i++];
    if (v === 'unknown') { await page.locator('.nq__dont').click(); await page.waitForTimeout(150); await grab(page); await page.locator('.q__next').click(); await page.waitForTimeout(250); }
    else { await page.locator('.nq__input').focus(); await page.locator('.nq__input').fill(v); await page.waitForTimeout(150); await grab(page); await page.locator('.nq__input').press('Enter'); await page.waitForTimeout(250); }
  }
  await page.waitForSelector('.reveal2__score', { timeout: 15000 }); await page.waitForTimeout(500); await grab(page);
  await page.waitForSelector('.reveal2', { state: 'detached', timeout: 10000 }); await page.waitForTimeout(500);
  await grab(page);
  const rows = await page.locator('.srow__main').count();
  for (let r = 0; r < rows; r++) { await page.locator('.srow__main').nth(r).click(); await page.waitForTimeout(300); await grab(page); }
  const hows = await page.locator('.ledger__how').count();
  for (let r = 0; r < hows; r++) { await page.locator('.ledger__how').nth(r).click(); await page.waitForTimeout(250); }
  await grab(page);
  if (await page.locator('.seg__opt').count()) { await page.locator('.seg__opt').nth(1).click(); await page.waitForTimeout(600); await grab(page); }
  await page.locator('#whatif-master').fill('50'); await page.waitForTimeout(200);
  await page.locator('.whatif__adjust').click(); await page.waitForTimeout(200); await grab(page);
  const faqs = await page.locator('.faq__q').count();
  for (let r = 0; r < faqs; r++) { await page.locator('.faq__q').nth(r).click(); await page.waitForTimeout(250); await grab(page); }
  if (opts.drawer) { await page.locator('.footer2__links button').first().click(); await page.waitForTimeout(300); await grab(page); await page.keyboard.press('Escape'); }
  if (opts.form) {
    await page.evaluate(() => document.getElementById('lead').scrollIntoView());
    await page.locator('#lead input[type=email]').fill('not-an-email');
    await page.locator('#lead input[type=tel]').fill('123');
    await page.locator('.leadf button[type=submit]').click(); await page.waitForTimeout(300); await grab(page);
    await page.locator('#lead input[autocomplete=name]').fill('Dana Lopez');
    await page.locator('#lead input[autocomplete=organization]').fill('Harbor Behavioral Health');
    await page.locator('#lead input[type=email]').fill('dana@harborbh.com');
    await page.locator('#lead input[type=tel]').fill('');
    await page.locator('.leadf button[type=submit]').click(); await page.waitForTimeout(800); await grab(page);
  }
  await ctx.close();
}

await runCase(0, ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'], null, { drawer: true, form: true });
await runCase(2, ['400000', '160000', '223200', '800', '72', '672', '520000', '210000'], true);
await runCase(3, ['200000', '80000', '110400', '500', 'unknown', 'unknown', '100000', 'unknown'], null);
await runCase(0, ['300000', '120000', '178200', '1500', '30', '1470', '90000', '8100'], null); // grade A, Keep It Top + share row
writeFileSync('c:/Spec Biller Scorecard/qa/visible-text.txt', [...texts].join('\n'));
console.log('unique visible lines:', texts.size);
await browser.close();
