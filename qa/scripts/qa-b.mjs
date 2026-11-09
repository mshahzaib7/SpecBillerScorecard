// QA section B through the real UI.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { EXE, SHOTS, answerFlow, readResults, ledgerGood } from './qa-lib.mjs';
mkdirSync(SHOTS, { recursive: true });

const GAP = 'Close the gap to top practices.';
const BUILD = 'Your biller should be able to give you these numbers.';
const KEEP = "You're performing at a high level. Let's keep it that way.";
const NR = 'Not reported';
const NG = 'Not graded';

const CASES = [
  { key: 'golden1', specialty: 'behavioral', values: ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'],
    exp: { letter: 'F', score: '56.3 / 100', you: ['92.5%', '57.0 days', '25.0%', '12.0%', '84.0%'], status: ['Watch', 'Watch', 'Problem', 'Problem', 'Problem'], top: ['$39,600', '$54,000', '$5,400', '$17,100'], good: ['$18,000', '$34,000', '$4,200', '$11,400'], stuck: '$28,500', figure: '$39,600 a year', opp: 'first-pass rate, 84% vs. 97%', offer: GAP } },
  { key: 'golden2', specialty: 'behavioral', values: ['300000', '120000', '166500', '1500', '180', 'unknown', '190000', '47500'],
    exp: { letter: 'F', score: '59.8 / 100', you: ['92.5%', '57.0 days', '25.0%', '12.0%', NR], status: ['Watch', 'Watch', 'Problem', 'Problem', NR], top: ['$39,600', '$54,000', '$5,400', '$17,100'], good: ['$18,000', '$34,000', '$4,200', '$11,400'], stuck: '$28,500', figure: '$39,600 a year', offer: GAP } },
  { key: 'golden3', specialty: 'behavioral', values: ['300000', '120000', '178200', '1500', '30', '1470', '90000', '8100'],
    exp: { letter: 'A', score: '100.0 / 100', you: ['99.0%', '27.0 days', '9.0%', '2.0%', '98.0%'], status: ['Good', 'Good', 'Good', 'Good', 'Good'], topMarkAll: true, top: [], good: [], ledgerEmpty: "Your billing is performing at a top level. That's rare. We'd love to help you keep it that way.", offer: KEEP } },
  { key: 'golden4', specialty: 'behavioral', values: ['300000', '120000', '172800', '1500', '60', '1425', '105000', '12600'],
    exp: { letter: 'A', score: '91.9 / 100', you: ['96.0%', '31.5 days', '12.0%', '4.0%', '95.0%'], status: ['Good', 'Good', 'Good', 'Good', 'Good'], top: ['$14,400', '$3,000', '$600', '$1,300'], good: ['Already at Good', 'Already at Good', 'Already at Good', 'Already at Good'], stuck: '$7,600', figure: '$14,400 a year', offer: KEEP } },
  { key: 'healthy', specialty: 'behavioral', values: ['300000', '120000', '172800', '1500', '120', '1350', '110000', '13200'],
    exp: { letter: 'B', score: '83.2 / 100', you: ['96.0%', '33.0 days', '12.0%', '8.0%', '90.0%'], status: ['Good', 'Good', 'Good', 'Watch', 'Watch'], top: ['$14,400', '$6,000', '$3,000', '$1,300'], good: ['Already at Good', 'Already at Good', '$1,800', 'Already at Good'], stuck: '$7,900', figure: '$14,400 a year', offer: GAP } },
  { key: 'all-unknown', specialty: 'behavioral', values: ['300000', '120000', '166500', '1500', 'unknown', 'unknown', '190000', 'unknown'],
    exp: { letter: 'No grade', score: 'Too few graded numbers', you: ['92.5%', '57.0 days', NR, NR, NR], status: ['Watch', 'Watch', NR, NR, NR], top: ['$39,600', '$54,000'], good: ['$18,000', '$34,000'], figure: '$39,600 a year', offer: BUILD, worthAsking: true } },
  { key: 'qa1', specialty: 'general', values: ['250000', '100000', '139500', '2000', '140', '1820', '125000', '22500'],
    exp: { letter: 'C', score: '73.5 / 100', you: ['93.0%', '45.0 days', '18.0%', '7.0%', '91.0%'], status: ['Watch', 'Watch', 'Watch', 'Watch', 'Watch'], top: ['$30,000', '$25,000', '$2,000', '$6,000'], good: ['$12,000', '$8,300', '$1,000', '$2,300'], stuck: '$13,500', figure: '$30,000 a year', opp: 'first-pass rate, 91% vs. 97%', biggestRow: 'First-pass rate', offer: GAP } },
  { key: 'qa2', specialty: 'accident', attorney: true, values: ['400000', '160000', '223200', '800', '72', '672', '520000', '210000'],
    exp: { letter: 'D', score: '62.9 / 100', you: ['93.0%', '117.0 days', '40.4%', '9.0%', '84.0%'], status: ['Watch', NG, NG, 'Watch', 'Problem'], top: ['$48,000', '$4,800'], good: ['$19,200', '$3,200'], ledgerNames: ['Uncollected money', 'Denied claims above target'], figure: '$48,000 a year', offer: GAP, piText: true } },
  { key: 'qa3', specialty: 'behavioral', values: ['360000', '144000', '205200', '1000', '50', '950', '160000', '24000'],
    exp: { letter: 'B', score: '85.0 / 100', you: ['95.0%', '40.0 days', '15.0%', '5.0%', '95.0%'], status: ['Good', 'Good', 'Good', 'Good', 'Good'], top: ['$25,900', '$24,000', '$1,400', '$4,800'], good: ['Already at Good', 'Already at Good', 'Already at Good', 'Already at Good'], stuck: '$14,400', roomToGrowAll: true, biggestRow: 'Net collection rate', offer: GAP, whatIf: true } },
  { key: 'qa4', specialty: 'other', values: ['200000', '80000', '110400', '500', 'unknown', 'unknown', '100000', 'unknown'],
    exp: { letter: 'No grade', score: 'Too few graded numbers', you: ['92.0%', '45.0 days', NR, NR, NR], status: ['Watch', 'Watch', NR, NR, NR], top: ['$28,800', '$20,000'], good: ['$14,400', '$6,700'], offer: BUILD, worthAsking: true } },
];

const browser = await chromium.launch({ executablePath: EXE.chromium });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const out = [];
for (const c of CASES) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const checks = [];
  const chk = (name, expected, actual) => checks.push({ name, pass: JSON.stringify(expected) === JSON.stringify(actual), expected, actual });
  try {
    await answerFlow(page, c);
    const r = await readResults(page);
    const good = await ledgerGood(page);
    const e = c.exp;
    chk('letter', e.letter, r.letter);
    chk('overall score', e.score, r.score);
    chk('statement values', e.you, r.rows.map((x) => x.you));
    chk('statement statuses', e.status, r.rows.map((x) => x.status));
    chk('statement Good/Top columns', ['95%', '40 days', '15%', '5%', '95%', '98%', '30 days', '10%', '3%', '97%'], [...r.rows.map((x) => x.good), ...r.rows.map((x) => x.top)]);
    chk('ledger vs Top', e.top, r.ledger.map((x) => x.fig));
    chk('ledger vs Good', e.good, good);
    if (e.stuck !== undefined) chk('over-90 stuck now', e.stuck, r.ledger.find((x) => x.sub)?.sub?.match(/\$[\d,]+/)?.[0] ?? null);
    if (e.figure) chk('verdict money line', e.figure, r.figure);
    if (e.opp) chk('biggest opportunity sentence', true, (r.opp ?? '').includes(e.opp));
    if (e.biggestRow) chk('biggest opportunity mark on row', e.biggestRow, r.rows.find((x) => x.marks.includes('Biggest opportunity'))?.name ?? null);
    if (e.topMarkAll) chk('Top performer mark on all 5 rows', 5, r.rows.filter((x) => x.marks.includes('Top performer')).length);
    if (e.roomToGrowAll) chk('every money row is Room to grow', r.ledger.length, r.ledger.filter((x) => x.unit?.includes('Room to grow')).length);
    if (e.ledgerEmpty) chk('top-level message when no money rows', e.ledgerEmpty, r.ledgerEmpty);
    if (e.ledgerNames) chk('only these money rows (PI rule hides the others)', e.ledgerNames, r.ledger.map((x) => x.name));
    chk('offer', e.offer, r.offer);
    if (e.worthAsking) chk('"worth asking about" note visible on the results statement without clicking', true, /worth asking about/i.test(r.statementText));
    if (e.piText) {
      const before = /can't be fairly graded/i.test(r.statementText);
      await page.locator('.srow__main').nth(1).click();
      await page.waitForTimeout(400);
      const after = /can't be fairly graded/i.test(await page.locator('#statement').innerText());
      chk('PI explanation shown (on expanding the Not graded row, per brief 7.7)', true, after);
      checks.push({ name: 'note: PI explanation visible before expanding', pass: true, expected: 'info', actual: before });
    }
    if (e.whatIf) {
      await page.evaluate(() => document.getElementById('simulator').scrollIntoView());
      await page.locator('#whatif-master').fill('0'); await page.waitForTimeout(300);
      const at0 = [await page.locator('.whatif__letter').textContent(), await page.locator('.whatif__score').textContent()];
      await page.locator('#whatif-master').fill('100'); await page.waitForTimeout(300);
      const at100 = [await page.locator('.whatif__letter').textContent(), await page.locator('.whatif__score').textContent()];
      chk('what-if at today / Good levels (already at Good)', ['B', '85.0 / 100'], at0);
      chk('what-if at Top levels', ['A', '100.0 / 100'], at100);
      await page.screenshot({ path: `${SHOTS}/B-${c.key}-whatif-100.png` });
    }
    chk('no page errors', [], errs);
    await page.evaluate(() => scrollTo(0, document.getElementById('results').getBoundingClientRect().top + scrollY - 64));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/B-${c.key}-verdict.png` });
    await page.evaluate(() => document.getElementById('statement').scrollIntoView()); await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/B-${c.key}-statement.png` });
    await page.evaluate(() => document.getElementById('money').scrollIntoView()); await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/B-${c.key}-ledger.png` });
  } catch (err) {
    checks.push({ name: 'flow completed', pass: false, expected: 'flow completes', actual: String(err).slice(0, 300) });
    await page.screenshot({ path: `${SHOTS}/B-${c.key}-ERROR.png` });
  }
  out.push({ case: c.key, checks });
  const f = checks.filter((x) => !x.pass);
  console.log(`${c.key}: ${checks.length - f.length}/${checks.length} pass${f.length ? '  FAIL: ' + f.map((x) => `${x.name} (expected ${JSON.stringify(x.expected)}, actual ${JSON.stringify(x.actual)})`).join(' | ') : ''}`);
  await page.close();
}
writeFileSync('c:/Spec Biller Scorecard/qa/results-B-ui.json', JSON.stringify(out, null, 2));
await browser.close();
