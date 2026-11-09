/**
 * The 4 golden cases from the spec (section 8), shared by the assertions
 * (golden.test.ts) and the expected-vs-actual report (golden-report.test.ts).
 *
 * If the engine ever disagrees with a value here, do NOT edit either side to
 * make them match — investigate which side is wrong.
 */
import type { MetricId, MoneyCardId, ScorecardInputs, ScorecardResult } from '../types';
import { UNKNOWN } from '../types';

/** 'exact' compares displayed (rounded) values; 'close' compares intermediates with toBeCloseTo(v, 6). */
export type CheckMode = 'exact' | 'close';

export interface Check {
  label: string;
  expected: number | string | boolean | null;
  actual: (r: ScorecardResult) => number | string | boolean | null;
  mode: CheckMode;
}

export interface GoldenCase {
  name: string;
  inputs: ScorecardInputs;
  checks: Check[];
}

const card = (r: ScorecardResult, id: MoneyCardId) => r.moneyCards.find((c) => c.id === id);

const STATUS_LABEL = { good: 'Good', watch: 'Watch', problem: 'Problem' } as const;
const statusText = (r: ScorecardResult, id: MetricId): string => {
  const m = r.metrics[id];
  if (m.availability !== 'graded' || m.status === null) return m.availability;
  return STATUS_LABEL[m.status] + (m.topPerformer ? ' + Top performer' : '');
};

/** value → score → status for one metric. */
function metricChecks(
  id: MetricId,
  label: string,
  value: number,
  score: number,
  status: string,
): Check[] {
  return [
    { label: `${label} value`, expected: value, actual: (r) => r.metrics[id].displayValue, mode: 'exact' },
    { label: `${label} score`, expected: score, actual: (r) => r.metrics[id].score, mode: 'close' },
    { label: `${label} status`, expected: status, actual: (r) => statusText(r, id), mode: 'exact' },
  ];
}

function moneyChecks(
  id: MoneyCardId,
  label: string,
  e: { kind: 'gap' | 'roomToGrow'; vsGood: number | null; vsTop: number; headline?: number },
): Check[] {
  const checks: Check[] = [
    { label: `${label} — card type`, expected: e.kind, actual: (r) => card(r, id)?.kind ?? 'no card', mode: 'exact' },
    {
      label: `${label} — vs Good`,
      expected: e.vsGood,
      actual: (r) => card(r, id)?.vsGood?.rounded ?? null,
      mode: 'exact',
    },
    {
      label: `${label} — vs Top`,
      expected: e.vsTop,
      actual: (r) => card(r, id)?.vsTop.rounded ?? null,
      mode: 'exact',
    },
  ];
  if (e.headline !== undefined) {
    checks.splice(1, 0, {
      label: `${label} — headline`,
      expected: e.headline,
      actual: (r) => card(r, id)?.headline?.rounded ?? null,
      mode: 'exact',
    });
  }
  return checks;
}

const overallChecks = (score: number, letter: string): Check[] => [
  { label: 'Overall score', expected: score, actual: (r) => r.overall.score, mode: 'exact' },
  { label: 'Letter grade', expected: letter, actual: (r) => r.overall.letter, mode: 'exact' },
];

// ---------------------------------------------------------------------------

export const STRUGGLING_INPUTS: ScorecardInputs = {
  specialty: 'behavioral',
  arIncludesAttorneyCases: null,
  painPoints: [],
  charges3: 300_000,
  adjustments3: 120_000,
  payments3: 166_500,
  claimsSubmitted3: 1_500,
  claimsDenied3: 180,
  claimsPaidFirstPass3: 1_260,
  totalAR: 190_000,
  ar90: 47_500,
};

export const TOP_INPUTS: ScorecardInputs = {
  // Spec gives no specialty for test 3; any non-PI specialty gives identical results.
  specialty: 'behavioral',
  arIncludesAttorneyCases: null,
  painPoints: [],
  charges3: 300_000,
  adjustments3: 120_000,
  payments3: 178_200,
  claimsSubmitted3: 1_500,
  claimsDenied3: 30,
  claimsPaidFirstPass3: 1_470,
  totalAR: 90_000,
  ar90: 8_100,
};

export const GOOD_NOT_TOP_INPUTS: ScorecardInputs = {
  // Spec gives no specialty for test 4; any non-PI specialty gives identical results.
  specialty: 'behavioral',
  arIncludesAttorneyCases: null,
  painPoints: [],
  charges3: 300_000,
  adjustments3: 120_000,
  payments3: 172_800,
  claimsSubmitted3: 1_500,
  claimsDenied3: 60,
  claimsPaidFirstPass3: 1_425,
  totalAR: 105_000,
  ar90: 12_600,
};

export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: 'Golden 1 — struggling practice',
    inputs: STRUGGLING_INPUTS,
    checks: [
      { label: 'netCharges', expected: 180_000, actual: (r) => r.base.netCharges, mode: 'close' },
      { label: 'netRatio', expected: 0.6, actual: (r) => r.base.netRatio, mode: 'close' },
      ...metricChecks('ncr', 'NCR %', 92.5, 72.5, 'Watch'),
      ...metricChecks('dar', 'Days in AR', 57.0, 63.75, 'Watch'),
      ...metricChecks('ar90', 'AR over 90 %', 25.0, 45, 'Problem'),
      ...metricChecks('den', 'Denial %', 12.0, 48, 'Problem'),
      ...metricChecks('fpr', 'First-pass %', 84.0, 36, 'Problem'),
      ...overallChecks(56.3, 'F'),
      ...moneyChecks('uncollected', 'Uncollected / yr', { kind: 'gap', vsGood: 18_000, vsTop: 39_600 }),
      ...moneyChecks('cashFaster', 'Cash faster one-time', { kind: 'gap', vsGood: 34_000, vsTop: 54_000 }),
      ...moneyChecks('deniedAboveTarget', 'Denied above target / mo', { kind: 'gap', vsGood: 4_200, vsTop: 5_400 }),
      ...moneyChecks('stuckOver90', 'Stuck over 90 days', {
        kind: 'gap',
        headline: 28_500,
        vsGood: 11_400,
        vsTop: 17_100,
      }),
    ],
  },
  {
    name: 'Golden 2 — renormalization + rounding edge (first-pass unknown)',
    inputs: { ...STRUGGLING_INPUTS, claimsPaidFirstPass3: UNKNOWN },
    checks: [
      { label: 'First-pass availability', expected: 'unavailable', actual: (r) => r.metrics.fpr.availability, mode: 'exact' },
      { label: 'Weighted sum', expected: 5085, actual: (r) => r.overall.weightedSum, mode: 'close' },
      { label: 'Weight total', expected: 85, actual: (r) => r.overall.weightTotal, mode: 'exact' },
      ...overallChecks(59.8, 'F'),
    ],
  },
  {
    name: 'Golden 3 — top-performing practice (integrity check)',
    inputs: TOP_INPUTS,
    checks: [
      ...metricChecks('ncr', 'NCR %', 99.0, 100, 'Good + Top performer'),
      ...metricChecks('dar', 'Days in AR', 27.0, 100, 'Good + Top performer'),
      ...metricChecks('ar90', 'AR over 90 %', 9.0, 100, 'Good + Top performer'),
      ...metricChecks('den', 'Denial %', 2.0, 100, 'Good + Top performer'),
      ...metricChecks('fpr', 'First-pass %', 98.0, 100, 'Good + Top performer'),
      ...overallChecks(100, 'A'),
      { label: 'Money cards', expected: 0, actual: (r) => r.moneyCards.length, mode: 'exact' },
    ],
  },
  {
    name: 'Golden 4 — good but not top',
    inputs: GOOD_NOT_TOP_INPUTS,
    checks: [
      ...metricChecks('ncr', 'NCR %', 96.0, 90, 'Good'),
      ...metricChecks('dar', 'Days in AR', 31.5, 97.75, 'Good'),
      ...metricChecks('ar90', 'AR over 90 %', 12.0, 94, 'Good'),
      ...metricChecks('den', 'Denial %', 4.0, 92.5, 'Good'),
      ...metricChecks('fpr', 'First-pass %', 95.0, 85, 'Good'),
      { label: 'Weighted sum', expected: 9190, actual: (r) => r.overall.weightedSum, mode: 'close' },
      ...overallChecks(91.9, 'A'),
      ...moneyChecks('uncollected', 'Uncollected / yr', { kind: 'roomToGrow', vsGood: null, vsTop: 14_400 }),
      ...moneyChecks('cashFaster', 'Cash faster one-time', { kind: 'roomToGrow', vsGood: null, vsTop: 3_000 }),
      ...moneyChecks('deniedAboveTarget', 'Denied above target / mo', {
        kind: 'roomToGrow',
        vsGood: null,
        vsTop: 600,
      }),
      ...moneyChecks('stuckOver90', 'Stuck over 90 days', {
        kind: 'roomToGrow',
        headline: 7_600,
        vsGood: null,
        vsTop: 1_300,
      }),
      { label: 'Money cards (no first-pass card)', expected: 4, actual: (r) => r.moneyCards.length, mode: 'exact' },
    ],
  },
];
