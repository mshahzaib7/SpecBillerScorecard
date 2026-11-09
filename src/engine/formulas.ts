/**
 * The metric formulas (spec section 4). This is the ONLY place they exist.
 * Always multiply by 100 (or by PERIOD_DAYS) before dividing.
 */
import { PERIOD_DAYS } from './config';
import { safeDiv } from './math';
import type { BaseFigures, MetricId, NumericInput, ScorecardInputs } from './types';

/** Inputs coerced to plain numbers; null = empty, "I don't know", or not a finite number. */
export interface Numbers {
  charges3: number | null;
  adjustments3: number | null;
  payments3: number | null;
  claimsSubmitted3: number | null;
  claimsDenied3: number | null;
  claimsPaidFirstPass3: number | null;
  totalAR: number | null;
  ar90: number | null;
}

export function num(v: NumericInput): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function toNumbers(inputs: ScorecardInputs): Numbers {
  return {
    charges3: num(inputs.charges3),
    adjustments3: num(inputs.adjustments3),
    payments3: num(inputs.payments3),
    claimsSubmitted3: num(inputs.claimsSubmitted3),
    claimsDenied3: num(inputs.claimsDenied3),
    claimsPaidFirstPass3: num(inputs.claimsPaidFirstPass3),
    totalAR: num(inputs.totalAR),
    ar90: num(inputs.ar90),
  };
}

export function computeBase(n: Numbers): BaseFigures {
  // netCharges = charges3 - adjustments3
  const netCharges =
    n.charges3 !== null && n.adjustments3 !== null ? n.charges3 - n.adjustments3 : null;
  // netRatio = netCharges / charges3
  const netRatio = netCharges !== null && n.charges3 !== null ? safeDiv(netCharges, n.charges3) : null;
  // avgDailyCharges = charges3 / PERIOD_DAYS
  const avgDailyCharges = n.charges3 !== null ? safeDiv(n.charges3, PERIOD_DAYS) : null;
  return { netCharges, netRatio, avgDailyCharges };
}

export function computeMetricValues(n: Numbers, base: BaseFigures): Record<MetricId, number | null> {
  return {
    // NCR = payments3 * 100 / netCharges
    ncr:
      n.payments3 !== null && base.netCharges !== null
        ? safeDiv(n.payments3 * 100, base.netCharges)
        : null,
    // DAR = totalAR * PERIOD_DAYS / charges3
    dar:
      n.totalAR !== null && n.charges3 !== null
        ? safeDiv(n.totalAR * PERIOD_DAYS, n.charges3)
        : null,
    // AR90 = ar90 * 100 / totalAR
    ar90: n.ar90 !== null && n.totalAR !== null ? safeDiv(n.ar90 * 100, n.totalAR) : null,
    // DEN = claimsDenied3 * 100 / claimsSubmitted3
    den:
      n.claimsDenied3 !== null && n.claimsSubmitted3 !== null
        ? safeDiv(n.claimsDenied3 * 100, n.claimsSubmitted3)
        : null,
    // FPR = claimsPaidFirstPass3 * 100 / claimsSubmitted3
    fpr:
      n.claimsPaidFirstPass3 !== null && n.claimsSubmitted3 !== null
        ? safeDiv(n.claimsPaidFirstPass3 * 100, n.claimsSubmitted3)
        : null,
  };
}
