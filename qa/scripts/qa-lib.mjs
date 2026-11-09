// Shared helpers for the QA browser runs.
export const BASE = 'http://localhost:5391/';
export const SHOTS = 'c:/Spec Biller Scorecard/qa/screenshots';
export const EXE = {
  chromium: 'C:/Users/HP/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
  edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
};
const TILE = { behavioral: 0, general: 1, accident: 2, other: 3 };

/** Answer the whole flow like a person: tap a tile, then type each number and press Enter. */
export async function answerFlow(page, { specialty, values, attorney = null, pains = [] }) {
  await page.goto(BASE);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.tile').nth(TILE[specialty]).click();
  await page.waitForSelector('.pain');
  await page.waitForTimeout(500);
  for (const p of pains) await page.locator('.pain').nth(p).click();
  await page.locator('.q__next').click();
  let i = 0;
  while (i < values.length) {
    await page.waitForFunction(() => document.querySelector('.choices2') || (document.activeElement && document.activeElement.classList.contains('nq__input')));
    if (await page.locator('.choices2').count()) {
      await page.locator('.choices2 .tile').nth(attorney ? 0 : 1).click();
      await page.waitForFunction(() => !document.querySelector('.choices2'));
      continue;
    }
    const v = values[i++];
    if (v === 'unknown') {
      await page.locator('.nq__dont').click();
      await page.locator('.q__next').click();
      await page.waitForTimeout(120);
    } else {
      await page.waitForFunction(() => document.activeElement?.classList.contains('nq__input') && document.activeElement.value === '');
      await page.keyboard.type(v, { delay: 15 });
      await page.keyboard.press('Enter');
    }
  }
  await page.waitForSelector('.reveal2', { state: 'attached', timeout: 15000 });
  await page.locator('.reveal2__skip').click();
  await page.waitForSelector('.reveal2', { state: 'detached' });
  await page.waitForTimeout(500);
}

/** Read every visible figure on the results page. */
export async function readResults(page) {
  return page.evaluate(() => {
    const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const rows = [...document.querySelectorAll('.srow')].map((r) => ({
      name: t(r.querySelector('.srow__name')),
      you: t(r.querySelector('.srow__you'))?.replace(/^You /, ''),
      good: t(r.querySelector('.srow__good'))?.replace(/^Good /, ''),
      top: t(r.querySelector('.srow__top'))?.replace(/^Top /, ''),
      status: t(r.querySelector('.sdot')) ?? t(r.querySelector('.srow__status .srow__muted')),
      marks: [...r.querySelectorAll('.mark')].map(t),
    }));
    const ledger = [...document.querySelectorAll('.ledger__row')].map((r) => ({ name: t(r.querySelector('.ledger__name')), unit: t(r.querySelector('.ledger__unit')), fig: t(r.querySelector('.ledger__figure')), sub: t(r.querySelector('.ledger__sub')) }));
    return {
      letter: t(document.querySelector('.verdict__letter')),
      score: t(document.querySelector('.verdict__score')),
      figure: t(document.querySelector('.verdict__figure')),
      opp: t(document.querySelector('.verdict__opp')),
      rows,
      ledger,
      ledgerEmpty: t(document.querySelector('.ledger__empty')),
      offer: t(document.querySelector('.next__headline')),
      offerFigure: t(document.querySelector('.next__amount')),
      statementText: document.getElementById('statement')?.innerText ?? '',
    };
  });
}

export async function ledgerGood(page) {
  if (!(await page.locator('.seg__opt').count())) return [];
  await page.locator('.seg__opt').nth(1).click();
  await page.waitForTimeout(700);
  const figs = await page.locator('.ledger__figure').allTextContents();
  await page.locator('.seg__opt').nth(0).click();
  await page.waitForTimeout(700);
  return figs.map((f) => f.trim());
}
