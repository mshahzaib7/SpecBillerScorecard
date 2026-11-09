/**
 * Money-gap formulas (spec section 6). This is the ONLY place they exist.
 * `T` is the target the gap is measured against (Good or Top).
 * Cards are never added together: they use different time units.
 */
import { PERIOD_MONTHS, PERIODS_PER_YEAR } from './config';
import { safeDiv } from './math';
import type { Numbers } from './formulas';
import type { BaseFigures } from './types';

/** 1. Uncollected money — per year (NCR). */
export function uncollectedPerYear(base: BaseFigures, ncr: number, T: number): number | null {
  if (base.netCharges === null) return null;
  return (base.netCharges * PERIODS_PER_YEAR * (T - ncr)) / 100;
}

/** 2. Cash that could come in faster — one-time (DAR). */
export function cashFasterOneTime(base: BaseFigures, dar: number, T: number): number | null {
  if (base.avgDailyCharges === null || base.netRatio === null) return null;
  return (dar - T) * base.avgDailyCharges * base.netRatio;
}

/** Parts of the denial money card, for the "How we calculated this" panel. */
export function deniedParts(
  n: Numbers,
  base: BaseFigures,
  T: number,
): { excessDeniedPerMonth: number; avgNetClaimValue: number } | null {
  if (n.claimsDenied3 === null || n.claimsSubmitted3 === null || n.charges3 === null) return null;
  if (base.netRatio === null) return null;
  const excessDeniedPerMonth = (n.claimsDenied3 - (T * n.claimsSubmitted3) / 100) / PERIOD_MONTHS;
  const avgClaimCharge = safeDiv(n.charges3, n.claimsSubmitted3);
  if (avgClaimCharge === null) return null;
  return { excessDeniedPerMonth, avgNetClaimValue: avgClaimCharge * base.netRatio };
}

/** 3. Denied claims above target — per month (Denial). Not money lost: most denials are recoverable. */
export function deniedAboveTargetPerMonth(n: Numbers, base: BaseFigures, T: number): number | null {
  const parts = deniedParts(n, base, T);
  return parts === null ? null : parts.excessDeniedPerMonth * parts.avgNetClaimValue;
}

/** 4a. Money stuck over 90 days — right now (headline). */
export function stuckOver90Headline(n: Numbers, base: BaseFigures): number | null {
  if (n.ar90 === null || base.netRatio === null) return null;
  return n.ar90 * base.netRatio;
}

/** 4b. Money stuck over 90 days — gap vs target. */
export function stuckOver90Gap(n: Numbers, base: BaseFigures, T: number): number | null {
  if (n.ar90 === null || n.totalAR === null || base.netRatio === null) return null;
  return (n.ar90 - (T * n.totalAR) / 100) * base.netRatio;
}
