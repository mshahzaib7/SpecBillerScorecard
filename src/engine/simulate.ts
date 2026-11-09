/**
 * "What if?" simulator. It does NOT have its own formulas: it turns slider values
 * back into equivalent report numbers and runs the same computeScorecard().
 *
 * Rules:
 * - Only metrics that were available in the original inputs can be overridden.
 * - A slider left at the user's exact value changes nothing, so the simulator and
 *   the reveal give identical results for identical numbers.
 * - When Days in AR changes, total AR changes; the AR-over-90 PERCENTAGE is held
 *   (or set by its own slider), so ar90 dollars scale with total AR.
 * - Denial % + first-pass % can never exceed 100 (they are separate shares of the
 *   same claims). Use applySliderChange(): moving one pushes the other back.
 *   simulateScorecard() also enforces it as a safety net by lowering first-pass.
 */
import { METRICS, METRIC_ORDER, PERIOD_DAYS } from './config';
import { computeScorecard } from './compute';
import { computeBase, computeMetricValues, toNumbers } from './formulas';
import type { MetricId, ScorecardInputs, ScorecardResult } from './types';

/** Denial % and first-pass % are shares of the same submitted claims: together at most 100. */
export const CLAIM_SHARE_MAX = 100;

export type MetricOverrides = Partial<Record<MetricId, number>>;

export function inputsForMetricValues(
  inputs: ScorecardInputs,
  overrides: MetricOverrides,
): ScorecardInputs {
  const n = toNumbers(inputs);
  const base = computeBase(n);
  const current = computeMetricValues(n, base);

  // Effective overrides: only for available metrics, and only when the value actually changes.
  const changed = (id: MetricId): number | null => {
    const v = overrides[id];
    const cur = current[id];
    if (v === undefined || !Number.isFinite(v) || cur === null) return null;
    return v === cur ? null : v;
  };

  const next: ScorecardInputs = { ...inputs };

  const ncr = changed('ncr');
  if (ncr !== null && base.netCharges !== null) {
    next.payments3 = (ncr * base.netCharges) / 100;
  }

  const den = changed('den');
  if (den !== null && n.claimsSubmitted3 !== null) {
    next.claimsDenied3 = (den * n.claimsSubmitted3) / 100;
  }

  let fpr = changed('fpr');
  // Safety net: keep denial % + first-pass % ≤ 100.
  const effDen = den ?? current.den;
  const effFpr = fpr ?? current.fpr;
  if (effDen !== null && effFpr !== null && effDen + effFpr > CLAIM_SHARE_MAX) {
    fpr = CLAIM_SHARE_MAX - effDen;
  }
  if (fpr !== null && n.claimsSubmitted3 !== null) {
    next.claimsPaidFirstPass3 = (fpr * n.claimsSubmitted3) / 100;
  }

  const dar = changed('dar');
  const ar90 = changed('ar90');
  let totalAR = n.totalAR;
  if (dar !== null && n.charges3 !== null) {
    totalAR = (dar * n.charges3) / PERIOD_DAYS;
    next.totalAR = totalAR;
  }
  if ((dar !== null || ar90 !== null) && totalAR !== null && current.ar90 !== null) {
    const pct = ar90 ?? current.ar90;
    next.ar90 = (pct * totalAR) / 100;
  }

  return next;
}

export function simulateScorecard(
  inputs: ScorecardInputs,
  overrides: MetricOverrides,
): ScorecardResult {
  return computeScorecard(inputsForMetricValues(inputs, overrides));
}

/**
 * Set one slider and keep the pair rule: if denial % + first-pass % would exceed
 * 100, the OTHER slider is pushed back so the total is exactly 100.
 */
export function applySliderChange(values: MetricOverrides, id: MetricId, value: number): MetricOverrides {
  const next: MetricOverrides = { ...values, [id]: value };
  if (id === 'den' || id === 'fpr') {
    const other: MetricId = id === 'den' ? 'fpr' : 'den';
    const o = next[other];
    if (o !== undefined && value + o > CLAIM_SHARE_MAX) next[other] = CLAIM_SHARE_MAX - value;
  }
  return next;
}

/** Starting slider values: the user's own value for every graded metric. */
export function sliderStartValues(result: ScorecardResult): MetricOverrides {
  const out: MetricOverrides = {};
  for (const id of METRIC_ORDER) {
    const m = result.metrics[id];
    if (m.availability === 'graded' && m.value !== null) out[id] = m.value;
  }
  return out;
}

/** True when `a` is at least as good as `b` for this metric. */
function atLeastAsGood(id: MetricId, a: number, b: number): boolean {
  return METRICS[id].direction === 'higherIsBetter' ? a >= b : a <= b;
}

/**
 * Master "Today → Top practices" slider (DESIGN-BRIEF 7.9).
 *
 * Returns overrides at share `t` (clamped to 0..1): every graded metric moves from the
 * visitor's own value toward the Top target by the same share.
 * - t = 0 → the visitor's exact values (simulating them reproduces the scorecard exactly).
 * - t = 1 → top-performer levels for every metric that is worse than Top.
 * - A metric already at or better than Top is held at the visitor's value (never made worse).
 * - Denial % + first-pass % stay at or below 100: both end points satisfy the rule and the
 *   path between them is a straight line, so every point in between does too.
 */
export function masterSliderOverrides(result: ScorecardResult, t: number): MetricOverrides {
  const share = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const start = sliderStartValues(result);

  // End point for each metric: Top, unless the visitor is already there.
  const end: MetricOverrides = {};
  for (const id of Object.keys(start) as MetricId[]) {
    const v = start[id]!;
    const top = METRICS[id].topTarget;
    end[id] = atLeastAsGood(id, v, top) ? v : top;
  }
  // Pair rule at the end point. Only possible when one of the two is held above Top;
  // the other then goes a little further in its good direction.
  if (end.den !== undefined && end.fpr !== undefined && end.den + end.fpr > CLAIM_SHARE_MAX) {
    if (start.fpr !== undefined && end.fpr === start.fpr) end.den = CLAIM_SHARE_MAX - end.fpr;
    else end.fpr = CLAIM_SHARE_MAX - end.den;
  }

  const out: MetricOverrides = {};
  for (const id of Object.keys(start) as MetricId[]) {
    const a = start[id]!;
    const b = end[id]!;
    out[id] = share === 0 ? a : share === 1 ? b : a + (b - a) * share;
  }
  // Safety net against floating-point drift.
  if (out.den !== undefined && out.fpr !== undefined && out.den + out.fpr > CLAIM_SHARE_MAX) {
    out.fpr = CLAIM_SHARE_MAX - out.den;
  }
  return out;
}

/** Slider values for "Show me Good levels" / "Show me top-performer levels" (graded metrics only). */
export function targetSliderValues(result: ScorecardResult, level: 'good' | 'top'): MetricOverrides {
  let out: MetricOverrides = {};
  for (const id of METRIC_ORDER) {
    if (result.metrics[id].availability !== 'graded') continue;
    const cfg = METRICS[id];
    out = applySliderChange(out, id, level === 'good' ? cfg.goodTarget : cfg.topTarget);
  }
  return out;
}
