// ONE real test lead through the real lead flow (NOT intercepted): Formspree receives it and emails it.
// Clearly labelled as a QA test. Usage: node qa/scripts/qa-lead-real.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { EXE, SHOTS, answerFlow } from './qa-lib.mjs';

const browser = await chromium.launch({ executablePath: EXE.chromium });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 730 } });
const page = await ctx.newPage();
const external = [];
page.on('request', (r) => {
  if (!r.url().startsWith('http://localhost:5391')) external.push({ url: r.url(), method: r.method(), body: r.postData(), t: Date.now() });
});
await answerFlow(page, { specialty: 'behavioral', values: ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'], pains: [0, 1] });
await page.locator('#offer-cta').click();
await page.waitForTimeout(800);
for (const t of ['An outside billing company', '2 to 5', 'TherapyNotes', 'As soon as possible', 'Yes, attach my scorecard', 'Call me']) {
  await page.locator('.lf__tile', { hasText: t }).first().click();
  await page.waitForTimeout(450);
}
await page.locator('.lf__continue').click();
await page.waitForTimeout(400);
await page.locator('#lead input[autocomplete=name]').fill('QA TEST Nov 14 (please ignore)');
await page.locator('#lead input[autocomplete=organization]').fill('QA Test Practice Nov 14');
await page.locator('#lead input[type=email]').fill('shahzaib.ventures@gmail.com');
await page.locator('#lead input[type=tel]').fill('8435550100');
const beforeSend = external.length;
const respP = page.waitForResponse((r) => r.url().includes('formspree.io'), { timeout: 20000 });
await page.locator('.lf__send').click();
const resp = await respP;
const status = resp.status();
const respText = await resp.text().catch(() => '');
await page.waitForSelector('.lf--done', { timeout: 10000 }).catch(() => null);
const done = await page.locator('.lf__donetitle').textContent().catch(() => null);
const sent = external.find((r) => r.url.includes('formspree.io') && r.method === 'POST');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${SHOTS}/nov14/real-lead-success.png` });
const out = { sentAt: new Date().toISOString(), status, respText, requestsBeforeSend: beforeSend, done, payload: sent ? JSON.parse(sent.body) : null };
writeFileSync('c:/Spec Biller Scorecard/qa/results-lead-real.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ status, respText: respText.slice(0, 200), beforeSend, done, subject: out.payload?._subject }));
await browser.close();
