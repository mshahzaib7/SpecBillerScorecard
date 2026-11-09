// QA section G: browsers and devices, plus a keyboard-only run.
import { chromium, firefox, webkit } from 'playwright';
import { existsSync, writeFileSync } from 'fs';
import { BASE, EXE, SHOTS, answerFlow } from './qa-lib.mjs';

const QA1 = { specialty: 'general', values: ['250000', '100000', '139500', '2000', '140', '1820', '125000', '22500'] };
const results = [];
const rec = (id, name, pass, expected, actual, shot = null) => {
  results.push({ id, name, pass, expected, actual, shot });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ` | expected: ${expected} | actual: ${actual}`}`);
};

const CONFIGS = [
  ...[['chrome', () => chromium.launch({ executablePath: EXE.chromium })], ['edge', () => chromium.launch({ executablePath: EXE.edge })], ['firefox', () => firefox.launch()]].flatMap(([b, launch]) =>
    [[1536, 730, 1.25], [1366, 768, 1], [1920, 1080, 1]].map(([w, h, dpr]) => ({ name: `${b}-${w}x${h}`, launch, ctx: { viewport: { width: w, height: h }, deviceScaleFactor: dpr }, mobile: false })),
  ),
  { name: 'chromium-mobile-390x844', launch: () => chromium.launch({ executablePath: EXE.chromium }), ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, mobile: true },
  { name: 'chromium-mobile-375x667', launch: () => chromium.launch({ executablePath: EXE.chromium }), ctx: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, mobile: true },
  { name: 'chromium-android-360x800', launch: () => chromium.launch({ executablePath: EXE.chromium }), ctx: { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, mobile: true },
  { name: 'chromium-tablet-834x1194', launch: () => chromium.launch({ executablePath: EXE.chromium }), ctx: { viewport: { width: 834, height: 1194 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, mobile: true },
];
if (!existsSync(EXE.edge)) console.log('Edge not found at', EXE.edge);
for (const n of ['safari-iphone14-390x844', 'safari-iphoneSE-375x667', 'safari-ipad-834x1194']) {
  results.push({ id: `G-${n}`, name: `${n}: SKIPPED: to be checked on a real iPhone/iPad after deploy (WebKit download did not finish)`, pass: null, skipped: true });
  console.log(`SKIPPED ${n}: to be checked on a real iPhone after deploy`);
}

for (const c of CONFIGS) {
  let browser;
  try {
    browser = await c.launch();
  } catch (e) {
    results.push({ id: `G-${c.name}`, name: `${c.name}: SKIPPED (browser could not launch)`, pass: null, skipped: true, expected: 'launches', actual: String(e).slice(0, 200) });
    console.log(`SKIPPED ${c.name}: ${String(e).slice(0, 120)}`);
    continue;
  }
  const ctx = await browser.newContext(c.ctx);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  let maxOverflow = 0;
  const shot = async (n) => {
    maxOverflow = Math.max(maxOverflow, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await page.screenshot({ path: `${SHOTS}/G-${c.name}-${n}.png` });
  };
  try {
    await page.goto(BASE); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
    await shot('1-hero');
    // inputmode on a money and a count question
    await page.locator('.tile').nth(1).click(); await page.waitForSelector('.pain'); await page.waitForTimeout(400);
    await page.locator('.q__next').click();
    await page.waitForSelector('.nq__input'); await page.waitForTimeout(300);
    const moneyMode = await page.locator('.nq__input').getAttribute('inputmode');
    await page.locator('.nq__where').click(); await page.waitForTimeout(250);
    await shot('2-question');
    for (const v of ['250000', '100000', '139500']) { await page.locator('.nq__input').fill(v); await page.locator('.nq__input').press('Enter'); await page.waitForTimeout(300); }
    const countMode = await page.locator('.nq__input').getAttribute('inputmode');
    rec(`G-${c.name}-keyboard-type`, `${c.name}: number pad on money (decimal) and claim (numeric) fields`, moneyMode === 'decimal' && countMode === 'numeric', 'decimal / numeric', `${moneyMode} / ${countMode}`);

    await answerFlow(page, QA1);
    const v = await page.evaluate(() => [document.querySelector('.verdict__letter')?.textContent, document.querySelector('.verdict__score')?.textContent, document.querySelector('.verdict__figure')?.textContent?.replace(/\s+/g, ' ').trim()]);
    rec(`G-${c.name}-figures`, `${c.name}: QA-1 flow completes with C, 73.5, $30,000 a year`, JSON.stringify(v) === JSON.stringify(['C', '73.5 / 100', '$30,000 a year']), 'C / 73.5 / $30,000 a year', JSON.stringify(v));
    await page.evaluate(() => scrollTo(0, document.getElementById('results').getBoundingClientRect().top + scrollY - 56)); await page.waitForTimeout(400);
    await shot('3-verdict');
    const verdictFits = await page.evaluate(() => document.querySelector('.verdict__actions .btn').getBoundingClientRect().bottom <= innerHeight);
    await page.evaluate(() => document.getElementById('cta').scrollIntoView()); await page.waitForTimeout(700);
    await shot('4-closing');
    // sticky bar vs content at the very bottom of the page
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(900);
    const cover = await page.evaluate(() => {
      const bar = document.querySelector('.msum');
      if (!bar || getComputedStyle(bar).display === 'none') return { visible: false };
      const b = bar.getBoundingClientRect();
      const covered = [...document.querySelectorAll('.footer2 p, .footer2 button, .founder2 a, .founder2 p')].filter((el) => { const r = el.getBoundingClientRect(); return r.height && r.bottom > b.top && r.top < b.bottom; }).map((el) => el.textContent.trim().slice(0, 40));
      return { visible: true, covered };
    });
    await shot('5-page-bottom');
    rec(`G-${c.name}-layout`, `${c.name}: no sideways scroll on any captured screen`, maxOverflow === 0, '0px', `${maxOverflow}px`, `qa/screenshots/G-${c.name}-3-verdict.png`);
    rec(`G-${c.name}-sticky`, `${c.name}: sticky bar never covers content (checked at the page bottom)`, !cover.visible || cover.covered.length === 0, 'no overlap', JSON.stringify(cover), `qa/screenshots/G-${c.name}-5-page-bottom.png`);
    if (c.mobile && c.ctx.viewport.width < 500) rec(`G-${c.name}-verdict-fit`, `${c.name}: verdict band button inside the first screen`, verdictFits, 'button visible', String(verdictFits), `qa/screenshots/G-${c.name}-3-verdict.png`);
    rec(`G-${c.name}-errors`, `${c.name}: no page errors`, errs.length === 0, 'none', errs.join(' | '));
  } catch (e) {
    rec(`G-${c.name}-flow`, `${c.name}: QA-1 flow completes`, false, 'completes', String(e).slice(0, 300));
    await page.screenshot({ path: `${SHOTS}/G-${c.name}-ERROR.png` }).catch(() => {});
  }
  await browser.close();
}

/* Keyboard only (Chrome 1440x900): no mouse at all. */
{
  const browser = await chromium.launch({ executablePath: EXE.chromium });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('**/formspree.io/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('https://calendly.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
  const page = await ctx.newPage();
  const k = page.keyboard;
  const focused = () => page.evaluate(() => { const a = document.activeElement; return `${a.tagName}.${a.className}|${(a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40)}`; });
  const tabTo = async (pred, max = 60) => { for (let n = 0; n < max; n++) { await k.press('Tab'); if (pred(await focused())) return true; } return false; };
  const steps = [];
  const step = (name, ok, info = '') => steps.push({ name, ok, info });
  await page.goto(BASE); await page.waitForTimeout(400);
  step('Skip link is the first Tab stop', (await tabTo((f) => f.includes('skiplink'), 1)));
  step('Tab reaches a practice tile', await tabTo((f) => f.includes('tile')));
  await k.press('Enter'); await page.waitForTimeout(1200);
  step('Tab reaches a pain chip, Space toggles it', await tabTo((f) => f.includes('pain'), 20));
  await k.press('Space'); await page.waitForTimeout(150);
  step('  chip is pressed', (await page.locator('.pain--on').count()) === 1);
  await tabTo((f) => f.includes('q__next'), 20); await k.press('Enter'); await page.waitForTimeout(400);
  step('Focus lands in the number input', (await focused()).includes('nq__input'));
  for (const v of QA1.values) { await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === ''); await k.type(v, { delay: 10 }); await k.press('Enter'); }
  await page.waitForSelector('.reveal2', { state: 'attached' }); await page.waitForTimeout(400);
  await k.press('Escape'); await page.waitForSelector('.reveal2', { state: 'detached' }); await page.waitForTimeout(600);
  step('Escape skips the reveal, results reached', (await page.locator('.verdict').count()) === 1);
  step('Tab reaches the offer button in the verdict band', await tabTo((f) => f.includes('Show me my 3 fixes'), 10));
  step('Tab reaches "See the full statement"', await tabTo((f) => f.includes('See the full statement'), 5));
  step('Tab reaches a statement row; Enter toggles it', await tabTo((f) => f.includes('srow__main'), 10));
  const openBefore = await page.locator('.srow--open').count();
  await k.press('Enter'); await page.waitForTimeout(400);
  step('  row state changed', (await page.locator('.srow--open').count()) !== openBefore || openBefore === 1);
  step('Tab reaches the compare switch; Arrow switches it', await tabTo((f) => f.includes('seg__opt'), 40));
  await k.press('ArrowRight'); await page.waitForTimeout(300);
  step('  "Good target" selected', (await page.locator('.seg__opt--on').textContent()) === 'Good target');
  step('Tab reaches the master slider; Arrow moves it', await tabTo((f) => f.includes('range'), 30));
  for (let n = 0; n < 10; n++) await k.press('ArrowRight');
  step('  slider moved to 10%', (await page.locator('#whatif-master').inputValue()) === '10');
  step('Tab reaches the form name field', await tabTo((f) => f.includes('lead__input'), 40));
  await k.type('Dana Lopez'); await k.press('Tab'); await k.type('Harbor Behavioral Health'); await k.press('Tab'); await k.type('dana@harborbh.com');
  await k.press('Enter'); await page.waitForTimeout(800);
  step('Enter submits the form; success shown', (await page.locator('.lead__donetitle').count()) === 1);
  step('Tab reaches an FAQ question; Enter opens it', await tabTo((f) => f.includes('faq__q'), 40));
  await k.press('Enter'); await page.waitForTimeout(300);
  step('  answer shown', (await page.locator('.faq__a').count()) === 1);
  step('Tab reaches "How we calculate" in the footer; Enter opens the drawer', await tabTo((f) => f.includes('How we calculate'), 60));
  await k.press('Enter'); await page.waitForTimeout(400);
  step('  drawer open, focus inside', (await page.locator('.mdraw').count()) === 1 && (await focused()).includes('mdraw__close'));
  await k.press('Escape'); await page.waitForTimeout(300);
  step('  Escape closes it, focus returns to the opener', (await page.locator('.mdraw').count()) === 0 && (await focused()).includes('How we calculate'));
  const visibleFocus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; });
  step('Focus ring visible (2px outline) on the focused control', visibleFocus);
  const failed = steps.filter((s) => !s.ok);
  rec('G-keyboard', 'Whole flow works with the keyboard alone (Chrome)', failed.length === 0, 'every step works', failed.length ? failed.map((s) => s.name).join(' | ') : `${steps.length} steps ok`);
  writeFileSync('c:/Spec Biller Scorecard/qa/results-G-keyboard.json', JSON.stringify(steps, null, 2));
  await browser.close();
}
writeFileSync('c:/Spec Biller Scorecard/qa/results-G.json', JSON.stringify(results, null, 2));
