// QA section C: validation and input handling through the real UI.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { BASE, EXE, SHOTS, answerFlow, readResults } from './qa-lib.mjs';

const browser = await chromium.launch({ executablePath: EXE.chromium });
const results = [];
const rec = (id, name, pass, expected, actual, shot = null) => {
  results.push({ id, name, pass, expected, actual, shot });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ` | expected: ${expected} | actual: ${actual}`}`);
};

/** Start the flow and get to the question for `field` index (0 = charges) with earlier answers typed. */
async function upTo(page, before) {
  await page.goto(BASE);
  await page.locator('.tile').first().click();
  await page.waitForSelector('.pain'); await page.waitForTimeout(400);
  await page.locator('.q__next').click();
  for (const v of before) {
    await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
    await page.keyboard.type(v, { delay: 10 }); await page.keyboard.press('Enter');
  }
  await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
}
const q = (page) => page.locator('.q__count').textContent();
const msg = async (page) => ((await page.locator('.nq__msg').count()) ? (await page.locator('.nq__msg').first().textContent()).trim() : null);
const isError = (r) => /nq__msg--error/.test(r.cls ?? '');
const isNote = (r) => /nq__msg--warn/.test(r.cls ?? '') && /You can continue/.test(r.afterBlur ?? '');
const msgClass = async (page) => ((await page.locator('.nq__msg').count()) ? await page.locator('.nq__msg').first().getAttribute('class') : null);
/** Type a value, leave the field (blur), read the message, then try Next. */
async function tryValue(page, v) {
  await page.locator('.nq__input').fill('');
  await page.locator('.nq__input').focus();
  await page.keyboard.type(v, { delay: 10 });
  const shown = await page.locator('.nq__input').inputValue();
  await page.locator('.nq__input').blur();
  await page.waitForTimeout(150);
  const afterBlur = await msg(page);
  const cls = await msgClass(page);
  const before = await q(page);
  await page.locator('.q__next').click();
  await page.waitForTimeout(350);
  const after = await q(page);
  return { shown, afterBlur, cls, advanced: before !== after, nextMsg: await msg(page) };
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// C1 adjustments >= charges (equal, then larger)
await upTo(page, ['300000']);
let r = await tryValue(page, '300000');
rec('C1a', 'Adjustments equal to charges is blocked with message 3 (own numbers, red)', !r.advanced && isError(r) && r.afterBlur?.startsWith("Adjustments ($300,000) can't be more than charges ($300,000)."), 'blocked + message 3', JSON.stringify(r));
r = await tryValue(page, '350000');
await page.screenshot({ path: `${SHOTS}/C1-adjustments-too-high.png` });
rec('C1b', 'Adjustments larger than charges is blocked', !r.advanced && isError(r) && r.afterBlur?.startsWith("Adjustments ($350,000) can't be more than charges ($300,000).") && /Use contractual adjustments for the same 3 months only\.$/.test(r.afterBlur ?? ''), 'blocked + message 3', JSON.stringify(r), 'qa/screenshots/C1-adjustments-too-high.png');

// C2 AR90 > total AR
await upTo(page, ['300000', '120000', '166500', '1500', '180', '1260', '190000']);
r = await tryValue(page, '200000');
await page.screenshot({ path: `${SHOTS}/C2-ar90-too-high.png` });
rec('C2', 'AR over 90 days larger than total AR is blocked with message 10 and "Edit total AR"', !r.advanced && isError(r) && /^This can't be more than your total AR \(\$190,000\), because it's part of that total\./.test(r.afterBlur ?? '') && /Edit total AR$/.test(r.afterBlur ?? ''), 'blocked + message 10 + link', JSON.stringify(r), 'qa/screenshots/C2-ar90-too-high.png');
await page.locator('.nq__edit').click();
await page.waitForTimeout(400);
const editTitle = await page.locator('.q__title').textContent();
const editFocus = await page.evaluate(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value);
rec('C2-edit', '"Edit total AR" jumps back to the total AR question with the answer kept', editTitle === 'How much is still unpaid today?' && editFocus === '190,000', 'total AR question, 190,000', `${editTitle} / ${editFocus}`);

// C3 claims rules
await upTo(page, ['300000', '120000', '166500', '1500']);
r = await tryValue(page, '1600');
rec('C3a', 'Denied larger than submitted is blocked (message 7, "Edit claims submitted")', !r.advanced && isError(r) && r.afterBlur === "Denied claims (1,600) can't be more than claims submitted (1,500). Check that both numbers cover the same 3 months. Edit claims submitted", 'blocked + message 7', JSON.stringify(r));
r = await tryValue(page, '180');
r = await tryValue(page, '1600');
rec('C3b', 'Paid first try larger than submitted is blocked (message 8)', !r.advanced && isError(r) && r.afterBlur === "Claims paid on the first try (1,600) can't be more than claims submitted (1,500). Check that both numbers cover the same 3 months. Edit claims submitted", 'blocked + message 8', JSON.stringify(r));
r = await tryValue(page, '1400');
await page.screenshot({ path: `${SHOTS}/C3-denied-plus-firstpass.png` });
rec('C3c', 'Denied + paid first try larger than submitted is blocked (message 9, "Edit denied claims")', !r.advanced && isError(r) && r.afterBlur === "Denied (180) plus paid on the first try (1,400) adds up to 1,580, more than the 1,500 claims you sent. A claim can't be both. Check that each count covers the same 3 months. Edit denied claims", 'blocked + message 9', JSON.stringify(r), 'qa/screenshots/C3-denied-plus-firstpass.png');

// C4 NCR rule (Nov 14): > 150% blocked; 105-150% not graded (note); 100-105% graded (note).
// The user's example practice: charges 75,000, adjustments 35,000 → owed 40,000.
await upTo(page, ['75000', '35000']);
r = await tryValue(page, '64000');
rec('C4a', 'Payments 64,000 (160%) are blocked with message 4 and "Edit adjustments"', !r.advanced && isError(r) && r.afterBlur === 'After $35,000 in contractual adjustments, you were owed about $40,000. Payments of $64,000 would mean collecting 160% of that, so one number is probably off. Check that adjustments are contractual only, with no bad debt or other write-offs. Edit adjustments', 'blocked + message 4', JSON.stringify(r));
await upTo(page, ['75000', '35000']);
r = await tryValue(page, '50000');
rec('C4b', 'Payments 50,000 (125%): amber note 5, Next allowed', r.advanced && isNote(r) && r.afterBlur === "Your payments ($50,000) are higher than what was owed after adjustments ($40,000). This happens when old claims from earlier months get paid in these 3 months. We've left this number out of your grade so it stays fair. You can continue.", 'note 5 + allowed', JSON.stringify(r));
await upTo(page, ['75000', '35000']);
r = await tryValue(page, '41800');
rec('C4c', 'Payments 41,800 (104.5%): amber note 6, Next allowed', r.advanced && isNote(r) && r.afterBlur === "Payments are a little higher than what was owed (104.5%). That's normal when late payments from earlier months arrive in this period. You can continue.", 'note 6 + allowed', JSON.stringify(r));
{
  // 125% all the way to the results: net collection rate shown, not graded, note on its row, other numbers graded
  const p4 = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await answerFlow(p4, { specialty: 'behavioral', values: ['75000', '35000', '50000', '1500', '180', '1260', '47500', '11875'] });
  const rr = await readResults(p4);
  const note = await p4.locator('.srow__note--warn').textContent().catch(() => null);
  rec('C4d', '125% in the results: "Not graded" row with note 5, no uncollected-money line, grade from the other 4', rr.rows[0].you === '125.0%' && rr.rows[0].status === 'Not graded' && /We've left this number out of your grade so it stays fair\.$/.test(note ?? '') && !/You can continue/.test(note ?? '') && !rr.ledger.some((x) => /collect/i.test(x.name ?? '')) && rr.letter !== null, 'Not graded + note, no NCR money, graded', `${rr.rows[0].you} ${rr.rows[0].status}; note "${note}"; ledger ${rr.ledger.map((x) => x.name).join(' | ')}; ${rr.letter} ${rr.score}`);
  await p4.context().close();
}

// C5 DAR > 365 warning only (charges 300,000 → AR 1,300,000 = 390 days)
await upTo(page, ['300000', '120000', '166500', '1500', '180', '1260']);
r = await tryValue(page, '1300000');
rec('C5', 'Days in AR above 365: amber note 11 with the visitor\'s days, Next allowed', r.advanced && isNote(r) && r.afterBlur === "Your total AR is more than a full year of charges (390 days). That's unusual. Check that total AR is today's total and charges cover only the last 3 months. You can continue.", 'note 11 + allowed', JSON.stringify(r));

// C6 fewer than 30 claims warning only
await upTo(page, ['300000', '120000', '166500']);
r = await tryValue(page, '25');
rec('C6', 'Fewer than 30 claims: amber note 12, Next allowed', r.advanced && isNote(r) && r.afterBlur === 'With fewer than 30 claims, a few claims can move the results a lot. You can continue, but treat the grade as a rough guide.', 'note 12 + allowed', JSON.stringify(r));

// C7 negatives, letters, empty (money field: charges)
await upTo(page, []);
r = await tryValue(page, '-5000');
rec('C7a', 'A minus sign in a money field is kept as typed, flagged with message 1 and blocked', r.shown === '-5000' && !r.advanced && r.afterBlur === 'Numbers only, please. You can type 12500, 12,500 or $12,500.' && isError(r), 'kept + message + blocked', JSON.stringify(r));
r = await tryValue(page, 'abc');
rec('C7b', 'Letters in a money field are kept, flagged and blocked', r.shown === 'abc' && !r.advanced && r.afterBlur === 'Numbers only, please. You can type 12500, 12,500 or $12,500.' && isError(r), 'kept + message + blocked', JSON.stringify(r));
await page.locator('.nq__input').fill('');
await page.locator('.q__next').click(); await page.waitForTimeout(250);
const emptyMsg = await msg(page);
rec('C7c', 'Empty required field is blocked with message 13', emptyMsg === 'Please enter this number to continue.', 'Please enter this number to continue.', String(emptyMsg));
r = await tryValue(page, '12k5');
rec('C7d', '"12k5" in a money field is kept, flagged and blocked (never silently stripped)', r.shown === '12k5' && !r.advanced && r.afterBlur === 'Numbers only, please. You can type 12500, 12,500 or $12,500.' && isError(r), 'kept + message + blocked', JSON.stringify(r));
r = await tryValue(page, '12..5');
rec('C7e', '"12..5" in a money field is kept, flagged and blocked', r.shown === '12..5' && !r.advanced && r.afterBlur === 'Numbers only, please. You can type 12500, 12,500 or $12,500.' && isError(r), 'kept + message + blocked', JSON.stringify(r));

// C8 currency formats, cents, paste
const shownFor = [];
for (const v of ['$12,500', '12,500', '12500']) {
  await upTo(page, []);
  await page.keyboard.type(v, { delay: 10 });
  shownFor.push(await page.locator('.nq__input').inputValue());
}
rec('C8a', '"$12,500", "12,500" and "12500" give the same value', shownFor.every((s) => s === '12,500'), 'all "12,500"', JSON.stringify(shownFor));
await upTo(page, []);
await page.keyboard.type('$12,500.50', { delay: 10 });
const cents = await page.locator('.nq__input').inputValue();
const centsMsg = await msg(page);
rec('C8b', '"$12,500.50" in a money field is valid and keeps its cents', cents === '12,500.50' && centsMsg === null, '"12,500.50", no message', `"${cents}", message ${centsMsg}`);
await upTo(page, []);
await page.keyboard.insertText('$ 300,000');
const pasted = await page.locator('.nq__input').inputValue();
const pastedMsg = await msg(page);
await page.keyboard.press('Enter'); await page.waitForTimeout(350);
rec('C8c', 'Pasted "$ 300,000" in a money field is valid and moves on', pasted === '300,000' && pastedMsg === null && /Question 4/.test(await q(page)), '"300,000", accepted', `"${pasted}", message ${pastedMsg}, now ${await q(page)}`);

// C9 claim counts: whole numbers only (field: claims submitted)
await upTo(page, ['300000', '120000', '166500']);
await page.keyboard.type('12.5', { delay: 10 });
const dec = await page.locator('.nq__input').inputValue();
const decMsg = await msg(page);
await page.locator('.q__next').click(); await page.waitForTimeout(300);
const decBlocked = /Question 6/.test(await q(page)); // still on claims submitted (Q6: specialty is Q1)
await page.screenshot({ path: `${SHOTS}/C9-decimal-claims.png` });
rec('C9a', '"12.5" claims: kept as typed, message 2, Next blocked', dec === '12.5' && decMsg === 'Please enter a whole number of claims, like 1,500.' && decBlocked, 'kept + message + blocked', `"${dec}", "${decMsg}", blocked ${decBlocked}`, 'qa/screenshots/C9-decimal-claims.png');
await page.locator('.nq__input').fill(''); await page.locator('.nq__input').focus();
await page.keyboard.type('12k5', { delay: 10 });
const k5 = await page.locator('.nq__input').inputValue();
const k5Msg = await msg(page);
await page.locator('.q__next').click(); await page.waitForTimeout(300);
rec('C9b', '"12k5" claims: kept as typed, whole-number message, Next blocked', k5 === '12k5' && k5Msg === 'Please enter a whole number of claims, like 1,500.' && /Question 6/.test(await q(page)), 'kept + message + blocked', `"${k5}", "${k5Msg}"`);
await page.locator('.nq__input').fill(''); await page.locator('.nq__input').focus();
await page.keyboard.insertText('1,500');
const ok15 = await page.locator('.nq__input').inputValue();
await page.keyboard.press('Enter'); await page.waitForTimeout(350);
rec('C9c', '"1,500" claims is valid and moves on', ok15 === '1,500' && /Question 7/.test(await q(page)), 'accepted', `"${ok15}", now ${await q(page)}`);

// C10 very large values (desktop and phone)
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p2 = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 })).newPage();
  await answerFlow(p2, { specialty: 'general', values: ['50000000', '20000000', '28000000', '100000', '9000', '85000', '25000000', '5000000'] });
  const rr = await readResults(p2);
  const text = await p2.evaluate(() => document.body.innerText);
  const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p2.evaluate(() => scrollTo(0, document.getElementById('results').getBoundingClientRect().top + scrollY - 60)); await p2.waitForTimeout(300);
  await p2.screenshot({ path: `${SHOTS}/C10-large-values-${w}-verdict.png` });
  await p2.evaluate(() => document.getElementById('money').scrollIntoView()); await p2.waitForTimeout(400);
  await p2.screenshot({ path: `${SHOTS}/C10-large-values-${w}-ledger.png` });
  const sci = /\d[eE][+-]?\d/.test(text);
  rec(`C10-${w}`, `Charges 50,000,000: no overflow, no scientific notation (${w}px)`, overflow === 0 && !sci, 'overflow 0, no e-notation', `overflow ${overflow}px, e-notation ${sci}, verdict "${rr.figure}", ledger ${rr.ledger.map((x) => x.fig).join(' ')}`, `qa/screenshots/C10-large-values-${w}-ledger.png`);
  await p2.context().close();
}

// C12 Back: change an earlier answer, statement and result update
await upTo(page, ['300000', '120000', '166500', '1500', '180', '1260', '190000']);
await page.locator('.q__back').click(); await page.waitForTimeout(300);
await page.locator('.q__back').click(); await page.waitForTimeout(300);
const backTitle = await page.locator('.q__title').textContent();
await page.locator('.nq__input').fill('1200');
await page.locator('.nq__input').press('Enter'); await page.waitForTimeout(300);
const stmtFpr = await page.evaluate(() => [...document.querySelectorAll('.stmt__line')].map((l) => l.textContent).find((t) => t.startsWith('First-pass rate')));
await page.locator('.nq__input').press('Enter'); await page.waitForTimeout(300);
await page.keyboard.type('47500', { delay: 10 }); await page.keyboard.press('Enter');
await page.waitForSelector('.reveal2', { state: 'attached' }); await page.locator('.reveal2__skip').click();
await page.waitForSelector('.reveal2', { state: 'detached' }); await page.waitForTimeout(400);
const after = await readResults(page);
rec('C12', 'Back, change paid-first-try 1,260 → 1,200: statement and final result update', /paid on the first try/i.test(backTitle) && /80\.0%/.test(stmtFpr ?? '') && after.rows[4].you === '80.0%', 'statement and result show 80.0%', `back to "${backTitle}", statement "${stmtFpr}", result ${after.rows[4].you}`);

// C13 change specialty after answering
const p3 = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const G1 = ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'];
await answerFlow(p3, { specialty: 'behavioral', values: G1 });
const r1 = await readResults(p3);
const why1 = await p3.locator('.srow--open .srow__col').nth(1).innerText();
async function rerun(tileIndex, attorney) {
  // The specialty is question 1 of the flow: go back to it, pick another, then Next through.
  await p3.evaluate(() => document.getElementById('form').scrollIntoView()); await p3.waitForTimeout(300);
  for (let k = 0; k < 14 && !(await p3.locator('.choices2').count() && /practice/i.test(await p3.locator('.q__title').textContent())); k++) {
    await p3.locator('.q__back').click(); await p3.waitForTimeout(300);
  }
  await p3.locator('.choices2 .tile').nth(tileIndex).click();
  await p3.waitForSelector('.pain'); await p3.waitForTimeout(500);
  for (let k = 0; k < 14; k++) {
    if (await p3.locator('.reveal2').count()) break;
    if (await p3.locator('.choices2').count()) { await p3.locator('.choices2 .tile').nth(attorney ? 0 : 1).click(); await p3.waitForTimeout(500); continue; }
    await p3.locator('.q__next').click(); await p3.waitForTimeout(350);
  }
  await p3.waitForSelector('.reveal2', { state: 'attached' }); await p3.locator('.reveal2__skip').click();
  await p3.waitForSelector('.reveal2', { state: 'detached' }); await p3.waitForTimeout(500);
  return readResults(p3);
}
const r2 = await rerun(1, null);
const why2 = await p3.locator('.srow--open .srow__col').nth(1).innerText();
const meta2 = await p3.locator('.statement__meta').textContent();
const sameMath = JSON.stringify([r1.letter, r1.score, r1.rows.map((x) => x.you), r1.ledger.map((x) => x.fig)]) === JSON.stringify([r2.letter, r2.score, r2.rows.map((x) => x.you), r2.ledger.map((x) => x.fig)]);
rec('C13a', 'Specialty Behavioral → Primary care: same math, explanations and label change', sameMath && why1 !== why2 && /Primary care/.test(meta2), 'identical figures; specialty line and label change', `same figures ${sameMath}; why text changed ${why1 !== why2}; label "${meta2}"`);
const r3 = await rerun(2, true);
rec('C13b', 'Specialty → Accident with attorney cases: PI rule applied (Days in AR, AR over 90 Not graded; 3-metric grade)', r3.rows[1].status === 'Not graded' && r3.rows[2].status === 'Not graded' && r3.letter === 'F' && r3.score === '56.5 / 100', 'DAR/AR90 Not graded; grade (30x72.5 + 20x48 + 15x36) / 65 = 56.5 F', `statuses ${r3.rows.map((x) => x.status).join(', ')}; grade ${r3.letter} ${r3.score}`);
await p3.screenshot({ path: `${SHOTS}/C13-specialty-accident.png` });

writeFileSync('c:/Spec Biller Scorecard/qa/results-C.json', JSON.stringify(results, null, 2));
await browser.close();
