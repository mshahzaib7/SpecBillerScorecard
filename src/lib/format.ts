import { MONEY_MIN_DISPLAY, type MoneyLine } from '../engine';

const usd = new Intl.NumberFormat('en-US');

/** "$39,600" — used for already-rounded money values. */
export function formatMoney(n: number): string {
  return `$${usd.format(n)}`;
}

/** "about $39,600", or "under $100" for tiny secondary lines. */
export function moneyText(line: MoneyLine): string {
  return line.belowMinimum ? `under ${formatMoney(MONEY_MIN_DISPLAY)}` : `about ${formatMoney(line.rounded)}`;
}

/** Metric value as displayed: one decimal, with its unit. */
export function formatMetric(value: number, unit: '%' | 'days'): string {
  return unit === '%' ? `${value.toFixed(1)}%` : `${value.toFixed(1)} days`;
}

export function formatTarget(value: number, unit: '%' | 'days'): string {
  return unit === '%' ? `${value}%` : `${value} days`;
}

/** Parse a formatted field. '' → null. */
export function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, '');
  if (cleaned === '' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Number of "meaningful" characters (digits and dot) before a caret position. */
export function significantBefore(s: string, caret: number): number {
  return s.slice(0, caret).replace(/[^\d.]/g, '').length;
}

/** Caret position in `s` after `count` meaningful characters. */
export function caretAfterSignificant(s: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (/[\d.]/.test(s[i]!)) seen++;
    if (seen === count) return i + 1;
  }
  return s.length;
}

/** The one date format used on the site: "November 9, 2026". */
export function preparedDate(d = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
