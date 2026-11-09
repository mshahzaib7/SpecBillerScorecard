// QA section D: the same figure everywhere, what-if endpoints, ledger toggle, print.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { BASE, EXE, SHOTS } from './qa-lib.mjs';

const CASES = [
  { key: 'golden1', specialty: 0, values: ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'], money: '$39,600', grade: ['F', '56.3 / 100'] },
  { key: 'qa1', specialty: 1, values: ['250000', '100000', '139500', '2000', '140', '1820', '125000', '22500'], money: '$30,000', grade: ['C', '73.5 / 100'] },
];
const GOOD = { 'Net collection rate': [95, 1], 'Days in AR': [40, -1], 'AR over 90 days': [15, -1], 'Denial rate': [5, -1], 'First-pass rate': [95, 1] };
const results = [];
const rec = (id, name, pass, expected, actual, shot = null) => {
  results.push({ id, name, pass, expected, actual, shot });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ` | expected: ${expected} | actual: ${actual}`}`);
};
const browser = await chromium.launch({ executablePath: EXE.chromium });

async function flow(page, c) {
  await page.goto(BASE);
  await page.locator('.tile').nth(c.specialty).click();
  await page.waitForSelector('.pain'); await page.waitForTimeout(400);
  await page.locator('.q__next').click();
  for (const v of c.values) {
    await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
    await page.keyboard.type(v, { delay: 10 }); await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.reveal2__score', { timeout: 15000 });
  await page.waitForTimeout(700);
  const reveal = await page.evaluate(() => ({ letter: document.querySelector('.reveal2__letter')?.textContent, score: document.querySelector('.reveal2__score')?.textContent, money: document.querySelector('.reveal2__money')?.textContent, values: [...document.querySelectorAll('.reveal2__value')].map((e) => e.textContent) }));
  if (await page.locator('.reveal2').count()) await page.locator('.reveal2__skip').click().catch(() => {});
  await page.waitForSelector('.reveal2', { state: 'detached' }); await page.waitForTimeout(500);
  return reveal;
}

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const reveal = await flow(page, c);
  const read = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? null, sel);
  const verdictFig = await read('.verdict__amount');
  const verdictGrade = [await read('.verdict__letter'), await read('.verdict__score')];
  const stmtValues = await page.locator('.srow__you').allTextContents().then((a) => a.map((s) => s.replace(/^You\s*/, '').trim()));
  const ledgerTop = await read('.ledger__row .ledger__figure');
  const offerFig = await read('.next__amount');
  // sticky top bar (desktop) after the verdict band scrolls away
  await page.evaluate(() => document.getElementById('money').scrollIntoView()); await page.waitForTimeout(800);
  const sticky = [await read('.topbar__grade strong'), await read('.topbar__grade .mono'), await read('.topbar__gap')];
  // what-if at 0
  await page.evaluate(() => document.getElementById('simulator').scrollIntoView()); await page.waitForTimeout(400);
  await page.locator('#whatif-master').fill('0'); await page.waitForTimeout(300);
  const wi0 = { letter: await read('.whatif__letter'), score: await read('.whatif__score'), money: await read('.whatif__figure'), values: await page.locator('.whatif__vval').allTextContents() };

  // mobile sticky bar
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  await flow(mp, c);
  await mp.evaluate(() => document.getElementById('money').scrollIntoView()); await mp.waitForTimeout(900);
  const msum = await mp.evaluate(() => document.querySelector('.msum__gap strong')?.textContent ?? null);
  await mp.screenshot({ path: `${SHOTS}/D-${c.key}-mobile-sticky.png` });
  await mctx.close();

  const m = c.money;
  const places = { reveal: reveal.money, verdict: verdictFig, ledger: ledgerTop, offer: offerFig?.replace(/ a year$/, ''), stickyDesktop: sticky[2]?.replace(/ a year$/, ''), stickyMobile: msum };
  rec(`D1-${c.key}-money`, `Headline figure ${m} identical in reveal, verdict, ledger, offer, both sticky bars`, Object.values(places).every((v) => v === m), m, JSON.stringify(places));
  const grades = { reveal: [reveal.letter, reveal.score], verdict: verdictGrade, sticky: [sticky[0], sticky[1]], whatIf0: [wi0.letter, wi0.score] };
  rec(`D1-${c.key}-grade`, `Grade ${c.grade.join(' ')} identical in reveal, verdict, sticky bar, what-if at 0%`, Object.values(grades).every((g) => JSON.stringify(g) === JSON.stringify(c.grade)), JSON.stringify(c.grade), JSON.stringify(grades));
  rec(`D1-${c.key}-values`, 'The five values are identical in reveal, statement and what-if at 0%', JSON.stringify(reveal.values) === JSON.stringify(stmtValues) && JSON.stringify(stmtValues) === JSON.stringify(wi0.values), JSON.stringify(stmtValues), JSON.stringify({ reveal: reveal.values, whatIf0: wi0.values }));

  // D2: what-if endpoints and the denial + first-pass limit
  rec(`D2-${c.key}-zero`, 'What-if at 0% equals the scorecard (+$0)', wi0.letter === c.grade[0] && wi0.score === c.grade[1] && /^\+\$0\b/.test(wi0.money ?? ''), `${c.grade.join(' ')} +$0`, JSON.stringify(wi0));
  let maxPair = 0;
  let pairAt = null;
  for (let t = 0; t <= 100; t += 2) {
    await page.locator('#whatif-master').fill(String(t)); await page.waitForTimeout(60);
    const vals = (await page.locator('.whatif__vval').allTextContents()).map((s) => parseFloat(s));
    const sum = vals[3] + vals[4];
    if (sum > maxPair) { maxPair = sum; pairAt = t; }
  }
  rec(`D2-${c.key}-pair`, 'Denial % + first-pass % never exceeds 100 while dragging (0 to 100% in 2% steps)', maxPair <= 100.05, '≤ 100', `max ${maxPair.toFixed(1)} at ${pairAt}%`);
  await page.locator('#whatif-master').fill('100'); await page.waitForTimeout(300);
  const wi100 = { letter: await read('.whatif__letter'), score: await read('.whatif__score'), values: await page.locator('.whatif__vval').allTextContents() };
  rec(`D2-${c.key}-top`, 'What-if at 100% equals top levels (A 100.0)', wi100.letter === 'A' && wi100.score === '100.0 / 100', 'A 100.0', JSON.stringify(wi100));
  await page.screenshot({ path: `${SHOTS}/D-${c.key}-whatif-100.png` });
  const snapLeft = await page.evaluate(() => document.querySelector('.whatif__snap')?.style.left ?? null);
  if (snapLeft) {
    await page.locator('#whatif-master').fill(String(parseFloat(snapLeft))); await page.waitForTimeout(300);
    const names = await page.locator('.whatif__vname').allTextContents();
    const vals = (await page.locator('.whatif__vval').allTextContents()).map((s) => parseFloat(s));
    const allGood = names.every((n, i) => { const [g, dir] = GOOD[n]; return dir > 0 ? vals[i] >= g - 0.05 : vals[i] <= g + 0.05; });
    const letter = await read('.whatif__letter');
    await page.screenshot({ path: `${SHOTS}/D-${c.key}-whatif-good.png` });
    rec(`D2-${c.key}-good`, `"Good levels" snap (${snapLeft}) puts every number at or better than Good`, allGood && ['A', 'B'].includes(letter), 'every value at/better than Good, grade B or better', `values ${vals.join(', ')}, grade ${letter}`, `qa/screenshots/D-${c.key}-whatif-good.png`);
  }

  // D3: ledger toggle
  await page.evaluate(() => document.getElementById('money').scrollIntoView()); await page.waitForTimeout(300);
  const topFigs = await page.locator('.ledger__figure').allTextContents();
  await page.locator('.seg__opt').nth(1).click(); await page.waitForTimeout(700);
  const goodFigs = await page.locator('.ledger__figure').allTextContents();
  rec(`D3-${c.key}`, 'Ledger toggle swaps every row to its Good figure (same rows, every row answered)', topFigs.length === goodFigs.length && goodFigs.every((g) => /^\$[\d,]+$|Already at Good|Under \$100/.test(g.trim())) && topFigs.join() !== goodFigs.join(), 'all rows switch', `top ${topFigs.join(' ')} | good ${goodFigs.join(' ')}`);
  await page.locator('.seg__opt').nth(0).click(); await page.waitForTimeout(500);

  // D4: print / PDF
  await page.evaluate(() => scrollTo(0, 0));
  const pdf = `c:/Spec Biller Scorecard/qa/print-${c.key}.pdf`;
  await page.pdf({ path: pdf, format: 'Letter', printBackground: true, preferCSSPageSize: true });
  const pages = (readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  await page.emulateMedia({ media: 'print' });
  const printView = await page.evaluate(() => {
    const vis = (s) => [...document.querySelectorAll(s)].filter((e) => getComputedStyle(e).display !== 'none' && e.getClientRects().length).map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    return { verdict: vis('.verdict__amount'), letter: vis('.verdict__letter'), score: vis('.verdict__score'), values: vis('.srow__you').map((s) => s.replace(/^You\s*/, '')), ledger: vis('.ledger__figure'), offer: vis('.next__amount') };
  });
  await page.emulateMedia({ media: 'screen' });
  const match = printView.verdict[0] === m && printView.ledger[0] === m && printView.offer[0] === `${m} a year` && printView.letter[0] === c.grade[0] && printView.score[0] === c.grade[1] && JSON.stringify(printView.values) === JSON.stringify(stmtValues) && JSON.stringify(printView.ledger) === JSON.stringify(topFigs);
  rec(`D4-${c.key}`, 'Print / PDF: 2 pages, and every printed number matches the screen', pages === 2 && match, '2 pages, same numbers', `${pages} pages; printed ${JSON.stringify(printView)}`, `qa/print-${c.key}.pdf`);
  await ctx.close();
}
writeFileSync('c:/Spec Biller Scorecard/qa/results-D.json', JSON.stringify(results, null, 2));
await browser.close();
