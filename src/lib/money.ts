/**
 * Money display and "How we got this" formulas for the results (verdict band, ledger, what-if).
 * Figures come from the engine; this file only formats them and plugs the visitor's numbers into
 * the formula text (moved here from the old money cards, wording unchanged).
 */
import {
  deniedClaimParts,
  METRICS,
  MONEY_MIN_DISPLAY,
  PERIOD_DAYS,
  PERIOD_MONTHS,
  PERIODS_PER_YEAR,
  type MoneyCard,
  type MoneyLine,
  type ScorecardInputs,
  type ScorecardResult,
} from '../engine';
import { formatMoney, moneyText } from './format';

/** Big figures never say "about" (DESIGN-BRIEF 13); "estimate" sits nearby instead. */
export function moneyFigure(line: MoneyLine): string {
  return line.belowMinimum ? `Under ${formatMoney(MONEY_MIN_DISPLAY)}` : formatMoney(line.rounded);
}

/** "$39,600 a year", "$12,000 one time"… */
export const UNIT_SUFFIX: Record<MoneyCard['timeUnit'], string> = {
  perYear: 'a year',
  oneTime: 'one time',
  perMonth: 'a month',
  rightNow: 'right now',
};

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usd = (n: number) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)}`;
const num = (v: ScorecardInputs[keyof ScorecardInputs]) => (typeof v === 'number' ? v : 0);

export interface Formula {
  rule: string;
  /** The visitor's numbers plugged in for the chosen level, or null when that level has no gap. */
  line: string | null;
  extra?: string | undefined;
}

export function formulaFor(card: MoneyCard, result: ScorecardResult, inputs: ScorecardInputs, level: 'top' | 'good'): Formula {
  const cfg = METRICS[card.metric];
  const value = result.metrics[card.metric].displayValue ?? 0;
  const netCharges = result.base.netCharges ?? 0;
  const netRatio = result.base.netRatio ?? 0;
  const daily = result.base.avgDailyCharges ?? 0;
  const T = level === 'top' ? cfg.topTarget : cfg.goodTarget;
  const money = level === 'top' ? card.vsTop : card.vsGood;
  const label = level === 'top' ? 'vs. top-performing practices' : 'vs. Good target';

  switch (card.id) {
    case 'uncollected':
      return {
        rule: `Net charges for 3 months × ${PERIODS_PER_YEAR} × (target rate − your rate) ÷ 100`,
        line: money && `${label}: ${usd(netCharges)} × ${PERIODS_PER_YEAR} × (${T} − ${value}) ÷ 100 = ${moneyText(money)} per year`,
      };
    case 'cashFaster':
      return {
        rule: `(Your days in AR − target days) × average daily charges × net ratio. Average daily charges = charges ÷ ${PERIOD_DAYS} days; net ratio = net charges ÷ charges.`,
        line: money && `${label}: (${value} − ${T}) × ${usd(daily)} × ${plain.format(netRatio)} = ${moneyText(money)}, one time`,
      };
    case 'deniedAboveTarget': {
      const parts = deniedClaimParts(inputs, T);
      const perMonth = parts ? plain.format(Math.round(parts.excessDeniedPerMonth * 10) / 10) : 'not available';
      const claimValue = parts ? usd(parts.avgNetClaimValue) : 'not available';
      return {
        rule: `(Denied claims − target % × claims submitted) ÷ ${PERIOD_MONTHS} months × average net claim value. Average net claim value = (charges ÷ claims submitted) × net ratio.`,
        line:
          money &&
          `${label}: (${plain.format(num(inputs.claimsDenied3))} − ${T}% × ${plain.format(num(inputs.claimsSubmitted3))}) ÷ ${PERIOD_MONTHS} = ${perMonth} claims per month × ${claimValue} = ${moneyText(money)} per month`,
      };
    }
    case 'stuckOver90':
      return {
        rule: 'Headline: AR over 90 days × net ratio. Gap: (AR over 90 days − target % × total AR) × net ratio.',
        extra: card.headline ? `Stuck right now: ${usd(num(inputs.ar90))} × ${plain.format(netRatio)} = ${moneyText(card.headline)}` : undefined,
        line: money && `${label}: (${usd(num(inputs.ar90))} − ${T}% × ${usd(num(inputs.totalAR))}) × ${plain.format(netRatio)} = ${moneyText(money)}`,
      };
  }
}
