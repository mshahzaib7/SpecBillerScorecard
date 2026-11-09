/**
 * The scorecard engine entry point. Pure: same inputs → same outputs.
 * The reveal and the "what if" simulator both go through computeScorecard().
 */
import { METRICS, METRIC_ORDER, MIN_METRICS_FOR_GRADE, MONEY_MIN_DISPLAY } from './config';
import { computeBase, computeMetricValues, toNumbers, type Numbers } from './formulas';
import { roundMoney, round1, EPS } from './math';
import {
  cashFasterOneTime,
  deniedAboveTargetPerMonth,
  deniedParts,
  stuckOver90Gap,
  stuckOver90Headline,
  uncollectedPerYear,
} from './money';
import { letterFromScore, meetsTarget, scoreFromAnchors, statusFromScore } from './scoring';
import type {
  BaseFigures,
  MetricId,
  MetricResult,
  MoneyCard,
  MoneyCardId,
  MoneyLine,
  OverallResult,
  ScorecardInputs,
  ScorecardResult,
} from './types';
import { validateInputs } from './validation';

/** True when the Accident / PI attorney-case rule excludes DAR and AR90 from grading. */
export function isPiRuleApplied(inputs: ScorecardInputs): boolean {
  return inputs.specialty === 'accident' && inputs.arIncludesAttorneyCases === true;
}

const PI_EXCLUDED: readonly MetricId[] = ['dar', 'ar90'];

function buildMetric(id: MetricId, value: number | null, excluded: boolean): MetricResult {
  if (value === null) {
    return { id, availability: 'unavailable', value: null, displayValue: null, score: null, status: null, topPerformer: false };
  }
  if (excluded) {
    return { id, availability: 'notGraded', value, displayValue: round1(value), score: null, status: null, topPerformer: false };
  }
  const cfg = METRICS[id];
  const score = scoreFromAnchors(value, cfg.anchors);
  return {
    id,
    availability: 'graded',
    value,
    displayValue: round1(value),
    score,
    status: statusFromScore(score),
    topPerformer: meetsTarget(value, cfg.topTarget, cfg.direction),
  };
}

function computeOverall(metrics: Record<MetricId, MetricResult>): OverallResult {
  let weightedSum = 0;
  let weightTotal = 0;
  let gradedCount = 0;
  for (const id of METRIC_ORDER) {
    const m = metrics[id];
    if (m.availability !== 'graded' || m.score === null) continue;
    const w = METRICS[id].weight;
    weightedSum += w * m.score;
    weightTotal += w;
    gradedCount++;
  }
  if (gradedCount < MIN_METRICS_FOR_GRADE || weightTotal === 0) {
    return { score: null, letter: null, gradedCount, weightedSum, weightTotal };
  }
  // Round ONCE; the same value drives both the display and the letter.
  const score = round1(weightedSum / weightTotal);
  return { score, letter: letterFromScore(score), gradedCount, weightedSum, weightTotal };
}

function line(raw: number | null): MoneyLine | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  const rounded = roundMoney(raw);
  return { raw, rounded, belowMinimum: rounded < MONEY_MIN_DISPLAY };
}

/**
 * Build one money card. A card exists only if the metric is graded and worse than
 * the Top target. The "vs Good" line exists only if it is also worse than Good.
 * If the largest line (vs Top) rounds below MONEY_MIN_DISPLAY, the whole card is hidden.
 */
function buildCard(
  id: MoneyCardId,
  metricId: MetricId,
  timeUnit: MoneyCard['timeUnit'],
  metric: MetricResult,
  gapFor: (T: number) => number | null,
  headline: number | null = null,
): MoneyCard | null {
  if (metric.availability !== 'graded' || metric.value === null) return null;
  const cfg = METRICS[metricId];
  if (meetsTarget(metric.value, cfg.topTarget, cfg.direction)) return null;
  const worseThanGood = !meetsTarget(metric.value, cfg.goodTarget, cfg.direction);
  const vsTop = line(gapFor(cfg.topTarget));
  if (vsTop === null || vsTop.raw <= EPS || vsTop.belowMinimum) return null;
  const vsGood = worseThanGood ? line(gapFor(cfg.goodTarget)) : null;
  return {
    id,
    metric: metricId,
    timeUnit,
    kind: worseThanGood ? 'gap' : 'roomToGrow',
    vsGood,
    vsTop,
    headline: line(headline),
  };
}

function computeMoneyCards(
  n: Numbers,
  base: BaseFigures,
  metrics: Record<MetricId, MetricResult>,
): MoneyCard[] {
  const { ncr, dar, den, ar90 } = metrics;
  const cards = [
    buildCard('uncollected', 'ncr', 'perYear', ncr, (T) =>
      ncr.value === null ? null : uncollectedPerYear(base, ncr.value, T),
    ),
    buildCard('cashFaster', 'dar', 'oneTime', dar, (T) =>
      dar.value === null ? null : cashFasterOneTime(base, dar.value, T),
    ),
    buildCard('deniedAboveTarget', 'den', 'perMonth', den, (T) => deniedAboveTargetPerMonth(n, base, T)),
    buildCard(
      'stuckOver90',
      'ar90',
      'rightNow',
      ar90,
      (T) => stuckOver90Gap(n, base, T),
      stuckOver90Headline(n, base),
    ),
  ];
  return cards.filter((c): c is MoneyCard => c !== null);
}

function findBiggestOpportunity(metrics: Record<MetricId, MetricResult>): MetricId | null {
  let best: MetricResult | null = null;
  for (const id of METRIC_ORDER) {
    const m = metrics[id];
    if (m.availability !== 'graded' || m.score === null || m.topPerformer) continue;
    if (
      best === null ||
      best.score === null ||
      m.score < best.score - EPS ||
      (Math.abs(m.score - best.score) <= EPS && METRICS[id].weight > METRICS[best.id].weight)
    ) {
      best = m;
    }
  }
  return best ? best.id : null;
}

/** Denial card intermediates (excess denied claims per month, average net claim value) for the explainer. */
export function deniedClaimParts(inputs: ScorecardInputs, T: number) {
  const n = toNumbers(inputs);
  return deniedParts(n, computeBase(n), T);
}

export function computeScorecard(inputs: ScorecardInputs): ScorecardResult {
  const validation = validateInputs(inputs);
  const n = toNumbers(inputs);
  const base = computeBase(n);
  const values = computeMetricValues(n, base);
  const piRuleApplied = isPiRuleApplied(inputs);

  const metrics = {} as Record<MetricId, MetricResult>;
  for (const id of METRIC_ORDER) {
    metrics[id] = buildMetric(id, values[id], piRuleApplied && PI_EXCLUDED.includes(id));
  }

  const overall = computeOverall(metrics);
  const moneyCards = computeMoneyCards(n, base, metrics);

  return {
    validation,
    base,
    metrics,
    overall,
    moneyCards,
    headlineCard: moneyCards[0] ?? null,
    biggestOpportunity: findBiggestOpportunity(metrics),
    piRuleApplied,
  };
}
