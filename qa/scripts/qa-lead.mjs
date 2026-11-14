// Lead flow QA (Nov 14 brief, Part 3), in a real browser against the production build.
// Every Formspree request is intercepted here: nothing real is sent (the one real test lead is qa-lead-real.mjs).
// Usage: node qa/scripts/qa-lead.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { EXE, SHOTS, answerFlow } from './qa-lib.mjs';

const G1 = ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'];
const results = [];
const rec = (id, name, pass, expected, actual, shot = null) => {
  results.push({ id, name, pass, expected, actual, shot });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ` | expected: ${expected} | actual: ${actual}`}`);
};
const browser = await chromium.launch({ executablePath: EXE.chromium });

/** Fresh page with a revealed scorecard and the lead flow open; every Formspree POST is captured, not sent. */
async function open(viewport = { width: 1536, height: 730 }, specialty = 'behavioral') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const posts = [];
  const external = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:5391')) external.push(r.url());
  });
  await ctx.route('**/formspree.io/**', (r) => {
    posts.push(JSON.parse(r.request().postData() ?? '{}'));
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await ctx.route('**/calendly.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>calendar</p>' }));
  await answerFlow(page, { specialty, values: G1, pains: [0, 1] });
  await page.locator('#offer-cta').click();
  await page.waitForTimeout(700);
  return { ctx, page, posts, external };
}
const title = (page) => page.locator('.lf__title').textContent();
const screenKey = (page) => page.locator('.lf__screen').getAttribute('data-screen');
const tap = async (page, label) => page.locator('.lf__tile', { hasText: label }).first().click();

// L1: tile auto-advance after ~250 ms, focus moves to the new question
{
  const { ctx, page } = await open();
  const t1 = await title(page);
  const focused0 = await page.evaluate(() => document.activeElement?.className);
  await tap(page, 'Someone on my staff');
  const at100 = await screenKey(page);
  await page.waitForTimeout(80);
  const on = await page.locator('.lf__tile--on').count();
  await page.waitForTimeout(250);
  const after = await screenKey(page);
  const focused = await page.evaluate(() => document.activeElement?.className);
  rec('L1a', 'Offer button opens the flow on screen 1 with focus on the question', t1 === 'Who handles your billing right now?' && /lf__title/.test(focused0), 'screen 1, title focused', `${t1} / ${focused0}`);
  rec('L1b', 'Tap: tile turns jade with a check, then moves on by itself after 250 ms', at100 === 'billingHandler' && on === 1 && after === 'providers' && /lf__title/.test(focused), 'billingHandler → providers', `${at100} → ${after}, on=${on}, focus=${focused}`);
  // L2: Back returns to the previous screen with the answer kept
  await page.locator('.lf__back').click();
  await page.waitForTimeout(300);
  const back = await screenKey(page);
  const kept = await page.locator('.lf__tile--on').textContent().catch(() => null);
  rec('L2', 'Back returns to the previous screen and keeps the answer', back === 'billingHandler' && /Someone on my staff/.test(kept ?? ''), 'billingHandler, staff selected', `${back}, ${kept}`);
  rec('L2b', 'No "step X of N" count shown', !(await page.locator('#lead').innerText()).match(/step \d|of \d/i), 'no count', 'checked');
  await ctx.close();
}

// L3: keyboard: number keys pick, Enter continues
{
  const { ctx, page } = await open();
  await page.keyboard.press('2');
  await page.waitForTimeout(450);
  const s2 = await screenKey(page);
  await page.keyboard.press('3');
  await page.waitForTimeout(450);
  const s3 = await screenKey(page);
  // Back to providers, then Enter continues with the kept answer
  await page.locator('.lf__back').click();
  await page.waitForTimeout(250);
  await page.locator('.lf__title').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  rec('L3', 'Number keys pick a tile; Enter continues', s2 === 'providers' && s3 === 'software' && (await screenKey(page)) === 'software', 'providers, software, software', `${s2}, ${s3}, ${await screenKey(page)}`);
  await ctx.close();
}

// L4: software order by specialty, "Something else" opens a field
for (const [spec, first] of [['behavioral', ['SimplePractice', 'TherapyNotes']], ['general', ['athenaOne', 'eClinicalWorks', 'AdvancedMD']]]) {
  const { ctx, page } = await open({ width: 1536, height: 730 }, spec);
  await tap(page, 'Someone on my staff');
  await page.waitForTimeout(400);
  await tap(page, 'Just me');
  await page.waitForTimeout(400);
  const labels = (await page.locator('.lf__tile .lf__label').allTextContents()).map((s) => s.trim());
  rec(`L4-${spec}`, `Software tiles for ${spec}: ${first.join(', ')} first`, first.every((f, i) => labels[i] === f) && labels.length === 8, first.join(', '), labels.join(', '));
  if (spec === 'behavioral') {
    await tap(page, 'Something else');
    await page.waitForTimeout(400);
    const stay = await screenKey(page);
    const field = await page.locator('.lf__field--other input').isVisible();
    await page.keyboard.type('CentralReach');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    rec('L4-other', '"Something else" opens a text field and does not move on by itself; Enter continues', stay === 'software' && field && (await screenKey(page)) === 'timing', 'software + field, then timing', `${stay}, ${field}, ${await screenKey(page)}`);
  }
  await ctx.close();
}

/** Answer screens 1 to 5. */
async function firstFive(page, review) {
  for (const t of ['An outside billing company', '2 to 5', 'TherapyNotes', 'As soon as possible', review]) {
    await tap(page, t);
    await page.waitForTimeout(400);
  }
}

// L5: contact methods: Email starts selected, at least one stays, no auto-advance
{
  const { ctx, page, posts } = await open();
  await firstFive(page, 'No, just my contact details');
  const s = await screenKey(page);
  const startOn = (await page.locator('.lf__tile--on').allTextContents()).map((x) => x.trim());
  await tap(page, 'Email me');
  await page.waitForTimeout(400);
  const stillOn = (await page.locator('.lf__tile--on').allTextContents()).map((x) => x.trim());
  const stillHere = await screenKey(page);
  rec('L5a', '"Email me" starts selected; it cannot be unselected when it is the only one; no auto-advance', s === 'contact' && startOn.length === 1 && /Email me/.test(startOn[0]) && stillOn.length === 1 && stillHere === 'contact', 'email on, stays on, still on contact', `${JSON.stringify(startOn)} → ${JSON.stringify(stillOn)}, ${stillHere}`);
  const almost = await page.locator('.lf__almost').textContent().catch(() => null);
  rec('L5b', '"Almost done" shows on the last two screens', almost === 'Almost done', 'Almost done', String(almost));
  // phone field: hidden for email only
  await page.locator('.lf__continue').click();
  await page.waitForTimeout(300);
  const phoneEmailOnly = await page.locator('#lead input[type=tel]').count();
  const reachEmail = await page.locator('.lf__reach').textContent();
  // email only: send without phone works; email required
  await page.locator('.lf__send').click();
  await page.waitForTimeout(200);
  const errs = (await page.locator('.lf__err').allTextContents()).map((x) => x.trim());
  rec('L6a', 'Email only: no phone field; name, practice and email are required', phoneEmailOnly === 0 && errs.length === 3 && /Your report goes there/.test(errs[2]) && reachEmail === "We'll reach you by email within one business day." && posts.length === 0, 'no tel, 3 errors, nothing sent', `${phoneEmailOnly} tel, ${JSON.stringify(errs)}, "${reachEmail}", posts ${posts.length}`);
  await ctx.close();
}

// L6b/c: call → phone required; text → phone hint; format hint is a placeholder
{
  const { ctx, page, posts } = await open();
  await firstFive(page, 'No, just my contact details');
  await tap(page, 'Call me');
  await tap(page, 'Text me');
  await page.locator('.lf__continue').click();
  await page.waitForTimeout(300);
  const tel = page.locator('#lead input[type=tel]');
  const ph = await tel.getAttribute('placeholder');
  const val = await tel.inputValue();
  const hint = await page.locator('.lf__hint').allTextContents();
  const reach = await page.locator('.lf__reach').textContent();
  await page.locator('#lead input[autocomplete=name]').fill('Dana Reyes');
  await page.locator('#lead input[autocomplete=organization]').fill('Harbor Behavioral Health');
  await page.locator('#lead input[type=email]').fill('dana@harborbh.com');
  await page.locator('.lf__send').click();
  await page.waitForTimeout(200);
  const phoneErr = await page.locator('.lf__field--error .lf__err').allTextContents();
  await tel.click();
  await page.keyboard.type('8435550142', { delay: 20 });
  const typed = await tel.inputValue();
  rec('L6b', 'Call or text picked: mobile field shown and required, "(555) 555-0142" is only a placeholder, text hint shown', ph === '(555) 555-0142' && val === '' && hint.includes('A mobile number that can receive texts.') && phoneErr.length === 1 && posts.length === 0, 'placeholder, empty, hint, 1 error, nothing sent', `ph=${ph} val="${val}" hints=${JSON.stringify(hint)} errs=${JSON.stringify(phoneErr)} posts=${posts.length}`);
  rec('L6c', 'Phone formats as it is typed', typed === '(843) 555-0142', '(843) 555-0142', typed);
  rec('L6d', 'Reach line joins the chosen methods', reach === "We'll reach you by call, text or email within one business day.", 'call, text or email', String(reach));
  await page.locator('.lf__send').click();
  await page.waitForSelector('.lf--done');
  const p = posts[0];
  rec('L7a', 'Send: exactly one POST; subject has priority, practice, grade, methods and timing', posts.length === 1 && p._subject === '[HIGH] New lead: Harbor Behavioral Health, grade F, wants a call, text or email, as soon as possible', '[HIGH] New lead: Harbor Behavioral Health, grade F, wants a call, text or email, as soon as possible', `${posts.length} posts, ${p?._subject}`);
  rec('L7b', '"No" picked: no scorecard numbers in the request', p && p.scorecardNumbers === undefined && !JSON.stringify(p).includes('92.5') && !JSON.stringify(p).includes('300,000'), 'no numbers', JSON.stringify(p));
  const done = await page.locator('.lf__donetitle').textContent();
  const reachDone = await page.locator('.lf__donereach').textContent();
  const cal = await page.locator('iframe.lf__booking').count();
  rec('L8', 'Success: "Thanks, Dana. Your report is on its way." + reach line + calendar', done === 'Thanks, Dana. Your report is on its way.' && reachDone === "We'll call, text or email you within one business day." && cal === 1, 'title, reach, iframe', `${done} | ${reachDone} | iframe ${cal}`);
  await ctx.close();
}

// L9: "Yes" → numbers attached; nothing sent before submit; calendar not requested before submit
{
  const { ctx, page, posts, external } = await open();
  await firstFive(page, 'Yes, attach my scorecard');
  await page.locator('.lf__continue').click();
  await page.waitForTimeout(300);
  await page.locator('#lead input[autocomplete=name]').fill('Sam');
  await page.locator('#lead input[autocomplete=organization]').fill('Calm Minds');
  await page.locator('#lead input[type=email]').fill('sam@calmminds.com');
  const beforeSend = [...external];
  await page.locator('.lf__send').click();
  await page.waitForSelector('.lf--done');
  const p = posts[0];
  rec('L9a', 'Nothing leaves the page before "Send my report" (no Formspree, no Calendly)', beforeSend.length === 0, 'no external requests', JSON.stringify(beforeSend));
  rec('L9b', '"Yes, attach my scorecard": numbers are in the request', posts.length === 1 && /Net collection rate: 92\.5%/.test(p.scorecardNumbers ?? '') && /Charges \(3 months\): \$300,000/.test(p.scorecardNumbers ?? ''), 'numbers included', String(p?.scorecardNumbers).slice(0, 120));
  await ctx.close();
}

// L10: honeypot: nothing sent
{
  const { ctx, page, posts } = await open();
  await firstFive(page, 'No, just my contact details');
  await page.locator('.lf__continue').click();
  await page.waitForTimeout(300);
  await page.locator('#lead input[autocomplete=name]').fill('Bot');
  await page.locator('#lead input[autocomplete=organization]').fill('Bot practice');
  await page.locator('#lead input[type=email]').fill('bot@example.com');
  await page.evaluate(() => {
    const hp = document.querySelector('.lf__hp input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(hp, 'http://spam.example');
    hp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.lf__send').click();
  await page.waitForTimeout(800);
  rec('L10', 'Honeypot filled: nothing is sent', posts.length === 0, '0 requests', `${posts.length} requests`);
  await ctx.close();
}

// L11: every offer and booking button opens the flow
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  const targets = [];
  for (const sel of ['.verdict__actions .btn--primary', '#offer-cta', '#cta-final .btn']) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const btn = page.locator(sel).first();
    if (!(await btn.count())) {
      targets.push(`${sel}: missing`);
      continue;
    }
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForTimeout(900);
    const inView = await page.evaluate(() => {
      const r = document.getElementById('lead').getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    const focus = await page.evaluate(() => document.activeElement?.className ?? '');
    targets.push(`${sel}: ${inView && /lf__title/.test(focus) ? 'ok' : `inView=${inView} focus=${focus}`}`);
  }
  const anchors = await page.evaluate(() => [...document.querySelectorAll('a')].filter((a) => /calendly/.test(a.href)).length);
  rec('L11', 'Offer, verdict and booking buttons all open the lead flow (no direct Calendly links)', targets.every((t) => t.endsWith(': ok')) && anchors === 0, 'all ok', JSON.stringify(targets) + ` calendlyLinks=${anchors}`);
  await ctx.close();
}

writeFileSync('c:/Spec Biller Scorecard/qa/results-lead.json', JSON.stringify(results, null, 2));
console.log(`\n${results.filter((r) => r.pass).length} / ${results.length} pass`);
await browser.close();
