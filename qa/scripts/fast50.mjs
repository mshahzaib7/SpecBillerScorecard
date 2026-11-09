import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: 'C:/Users/HP/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5391/');
await page.locator('.tile').first().click(); await page.waitForTimeout(900);
await page.locator('.q__next').click();
const vals = ['300000', '120000', '166500', '1500', '180', '1260', '190000', '47500'];
for (const v of vals) {
  await page.waitForTimeout(50);                      // far faster than a person
  await page.keyboard.type(v, { delay: 5 });
  await page.keyboard.press('Enter');

}
await page.waitForTimeout(1500);
const lines = await page.evaluate(() => [...document.querySelectorAll('.stmt__line--input .stmt__value .flash__text')].map((e) => e.textContent));
const atReveal = await page.locator('.reveal2').count();
const q = await page.locator('.q__count').textContent().catch(() => null);
console.log('statement inputs:', lines.join(', '));
console.log('reveal shown:', atReveal > 0, '| question:', q);
const expected = ['$300,000', '$120,000', '$166,500', '1,500', '180', '1,260', '$190,000', '$47,500'];
const corrupted = lines.filter((l, i) => expected[i] && l !== expected[i]);
console.log(corrupted.length ? 'CORRUPTED: ' + corrupted.join(', ') : 'no earlier answer was changed (keystrokes during a transition are dropped, never written into the previous field)');
await browser.close();
