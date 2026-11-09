// QA section E: the lead form. Two REAL submissions (labelled as QA tests), the rest intercepted.
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

async function fill(page, { name, practice, phone, numbers }) {
  await page.evaluate(() => document.getElementById('lead').scrollIntoView());
  await page.locator('#lead input[autocomplete=name]').fill(name);
  await page.locator('#lead input[autocomplete=organization]').fill(practice);
  await page.locator('#lead input[type=email]').fill('shahzaib.ventures@gmail.com');
  await page.locator('#lead input[type=tel]').fill(phone);
  if (numbers) await page.locator('.lead__check').click();
}

/** Real submission; returns the JSON body that was sent and every request made. */
async function realSubmit(label, numbers) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData(), t: Date.now() }));
  await answerFlow(page, { specialty: 'behavioral', values: G1, pains: [0, 1] });
  await fill(page, { name: `QA TEST ${label} (please ignore)`, practice: `QA Test Practice ${label}`, phone: '843 555 0100', numbers });
  const beforeSubmit = requests.filter((r) => !r.url.startsWith('http://localhost:5391'));
  const submitAt = Date.now();
  const respP = page.waitForResponse((r) => r.url().includes('formspree.io'), { timeout: 20000 }).catch(() => null);
  await page.locator('.leadf button[type=submit]').click();
  const resp = await respP;
  await page.waitForTimeout(2500);
  const sent = requests.find((r) => r.url.includes('formspree.io') && r.method === 'POST');
  const done = await page.locator('.lead__donetitle').textContent().catch(() => null);
  const errorMsg = await page.locator('.lead__msg').textContent().catch(() => null);
  const iframe = await page.locator('iframe.lead__booking').getAttribute('src').catch(() => null);
  const calendlyBefore = requests.filter((r) => r.url.includes('calendly') && r.t < submitAt).length;
  const calendlyAfter = requests.filter((r) => r.url.includes('calendly') && r.t >= submitAt).length;
  await page.evaluate(() => document.getElementById('lead').scrollIntoView()); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/E-success-${label}.png` });
  await ctx.close();
  return { body: sent ? JSON.parse(sent.body) : null, status: resp?.status() ?? null, respText: resp ? await resp.text().catch(() => '') : '', beforeSubmit, done, errorMsg, iframe, calendlyBefore, calendlyAfter };
}

const a = await realSubmit('A-no-numbers', false);
const b = await realSubmit('B-with-numbers', true);
console.log('Formspree responses:', a.status, a.respText.slice(0, 200), '|', b.status, b.respText.slice(0, 200));
writeFileSync('c:/Spec Biller Scorecard/qa/results-E-payloads.json', JSON.stringify({ a: a.body, b: b.body, statusA: a.status, statusB: b.status, respA: a.respText, respB: b.respText }, null, 2));

const need = ['_subject', 'name', 'practiceName', 'email', 'phone', 'specialty', 'grade', 'offer', 'painPoints'];
rec('E1a', 'Payload carries name, practice, email, phone, specialty, grade, offer, pain points and the subject', a.body && need.every((k) => a.body[k] !== undefined && a.body[k] !== '') && a.body._subject === 'New scorecard lead: QA Test Practice A-no-numbers, grade F', need.join(', '), JSON.stringify(a.body));
rec('E1b', 'Formspree accepted both submissions (HTTP 200)', a.status === 200 && b.status === 200, '200 / 200', `${a.status} / ${b.status}`);
rec('E2a', 'Checkbox unticked: no scorecard numbers in the payload', a.body && a.body.includeNumbers === false && a.body.scorecard === undefined && !JSON.stringify(a.body).includes('92.5'), 'no numbers', JSON.stringify(a.body));
rec('E2b', 'Checkbox ticked: the 5 values and money figures are included', b.body?.scorecard?.metrics?.ncr === 92.5 && b.body.scorecard.moneyCards.length === 4, 'numbers included', JSON.stringify(b.body?.scorecard));
rec('E3b', 'Nothing leaves the page before Submit (whole flow, both runs)', a.beforeSubmit.length === 0 && b.beforeSubmit.length === 0, 'no external requests', JSON.stringify([...a.beforeSubmit, ...b.beforeSubmit].map((r) => r.url)));
rec('E5a', 'Success message "Thanks, [Name]. Your report is on its way."', a.done === 'Thanks, QA. Your report is on its way.', 'Thanks, QA. Your report is on its way.', String(a.done ?? a.errorMsg), 'qa/screenshots/E-success-A-no-numbers.png');
rec('E5b', 'Booking calendar loads only after a successful send', a.calendlyBefore === 0 && a.calendlyAfter > 0 && (a.iframe ?? '').startsWith('https://calendly.com/muhammadshahzaibkhan/30min'), '0 Calendly requests before, iframe after', `before ${a.calendlyBefore}, after ${a.calendlyAfter}, iframe ${a.iframe}`, 'qa/screenshots/E-success-A-no-numbers.png');

// E3a honeypot (intercepted: nothing may be sent)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let posted = 0;
  await ctx.route('**/formspree.io/**', (r) => { posted++; r.fulfill({ status: 200, body: '{}' }); });
  await answerFlow(page, { specialty: 'behavioral', values: G1 });
  await fill(page, { name: 'Bot', practice: 'Bot practice', phone: '', numbers: false });
  await page.evaluate(() => {
    const hp = document.querySelector('.lead__hp input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(hp, 'http://spam.example');
    hp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('.leadf button[type=submit]').click(); await page.waitForTimeout(800);
  rec('E3a', 'Honeypot filled: nothing is sent', posted === 0, '0 requests', `${posted} requests`);
  await ctx.close();
}

// E4 error case (request blocked)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await ctx.route('**/formspree.io/**', (r) => r.abort('failed'));
  await answerFlow(page, { specialty: 'behavioral', values: G1 });
  await fill(page, { name: 'Dana Lopez', practice: 'Harbor Behavioral Health', phone: '843 555 0100', numbers: true });
  await page.locator('.leadf button[type=submit]').click(); await page.waitForTimeout(800);
  const msg = await page.locator('.lead__msg--error').textContent().catch(() => null);
  const kept = [await page.locator('#lead input[autocomplete=name]').inputValue(), await page.locator('#lead input[autocomplete=organization]').inputValue(), await page.locator('#lead input[type=email]').inputValue(), await page.locator('#lead input[type=tel]').inputValue()];
  const fallback = await page.locator('.lead__msg--error a').getAttribute('href').catch(() => null);
  await page.screenshot({ path: `${SHOTS}/E4-blocked-request.png` });
  rec('E4', 'Blocked request: friendly message, email fallback, everything typed is kept', /couldn't send that just now/.test(msg ?? '') && kept.join('|') === 'Dana Lopez|Harbor Behavioral Health|shahzaib.ventures@gmail.com|843 555 0100' && (fallback ?? '').startsWith('mailto:shahzaib.ventures@gmail.com'), 'message + fallback + values kept', `msg "${msg}", kept ${JSON.stringify(kept)}, fallback ${fallback?.slice(0, 50)}`, 'qa/screenshots/E4-blocked-request.png');
  // E6 booking buttons
  const links = await page.evaluate(() => [...document.querySelectorAll('a')].filter((a) => /book/i.test(a.textContent) || /calendly/.test(a.href)).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), target: a.target })));
  rec('E6', 'Every booking button opens the Calendly link in a new tab', links.length > 0 && links.every((l) => l.href === 'https://calendly.com/muhammadshahzaibkhan/30min' && l.target === '_blank'), 'all → calendly.com/muhammadshahzaibkhan/30min', JSON.stringify(links));
  await ctx.close();
}
writeFileSync('c:/Spec Biller Scorecard/qa/results-E.json', JSON.stringify(results, null, 2));
await browser.close();
