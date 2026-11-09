/**
 * QA ORACLE: an independent implementation of SPEC-biller-scorecard.md sections 4, 5, 6 and 12.1.
 * Written from the spec text only. It must NOT import anything from src/.
 *
 * Rules taken from outside sections 4 to 6 (stated so a reviewer can check them):
 * - Headline money card: spec 9C "the NCR gap vs Top; if NCR is unavailable or already top, use the
 *   next available card", i.e. the first card in the order uncollected, cash faster, denied, over 90.
 * - Biggest opportunity: spec 9F "the metric with the lowest score"; ties go to the higher weight
 *   (QA checklist B4), then to display order. Metrics already at score 100 have no opportunity.
 * - Money card visibility: hidden if its vs-Top line rounds below $100; a smaller vs-Good line shows
 *   as "under $100" (QA checklist A).
 */

export type Id = 'ncr' | 'dar' | 'ar90' | 'den' | 'fpr';
export const ORDER: Id[] = ['ncr', 'dar', 'ar90', 'den', 'fpr'];
export type Num = number | 'unknown';

export interface OInputs {
  specialty: 'behavioral' | 'general' | 'accident' | 'other';
  attorney: boolean | null;
  charges3: number;
  adjustments3: number;
  payments3: number;
  claimsSubmitted3: number;
  claimsDenied3: Num;
  claimsPaidFirstPass3: Num;
  totalAR: number;
  ar90: Num;
}

/* ---------- Spec section 5: targets, anchors, weights ---------- */
const HIGHER: Record<Id, boolean> = { ncr: true, dar: false, ar90: false, den: false, fpr: true };
export const GOOD: Record<Id, number> = { ncr: 95, dar: 40, ar90: 15, den: 5, fpr: 95 };
export const TOP: Record<Id, number> = { ncr: 98, dar: 30, ar90: 10, den: 3, fpr: 97 };
const ANCHORS: Record<Id, [number, number][]> = {
  ncr: [[80, 0], [90, 60], [95, 85], [98, 100]],
  dar: [[30, 100], [40, 85], [60, 60], [90, 0]],
  ar90: [[10, 100], [15, 85], [20, 60], [40, 0]],
  den: [[3, 100], [5, 85], [10, 60], [20, 0]],
  fpr: [[75, 0], [90, 60], [95, 85], [97, 100]],
};
const WEIGHT: Record<Id, number> = { ncr: 30, dar: 20, den: 20, ar90: 15, fpr: 15 };
const PERIOD_DAYS = 90;

export const round1 = (x: number) => Math.round(x * 10 + 1e-9) / 10;
export const roundMoney = (x: number) => Math.round(x / 100 + 1e-9) * 100;

function score(id: Id, v: number): number {
  const a = ANCHORS[id];
  if (v <= a[0]![0]) return a[0]![1];
  if (v >= a[a.length - 1]![0]) return a[a.length - 1]![1];
  for (let i = 0; i < a.length - 1; i++) {
    const [va, sa] = a[i]!;
    const [vb, sb] = a[i + 1]!;
    if (v >= va && v <= vb) return sa + ((v - va) * (sb - sa)) / (vb - va);
  }
  throw new Error('unreachable');
}
const statusOf = (s: number) => (s >= 85 ? 'good' : s >= 60 ? 'watch' : 'problem');
const better = (id: Id, v: number, t: number) => (HIGHER[id] ? v >= t : v <= t);
const worse = (id: Id, v: number, t: number) => !better(id, v, t);

/* ---------- Result shape ---------- */
export interface OMetric {
  availability: 'graded' | 'notGraded' | 'unavailable';
  value: number | null;
  display: number | null;
  score: number | null;
  status: 'good' | 'watch' | 'problem' | null;
  top: boolean;
}
export interface OLine {
  rounded: number;
  under100: boolean;
}
export interface OCard {
  id: 'uncollected' | 'cashFaster' | 'deniedAboveTarget' | 'stuckOver90';
  kind: 'gap' | 'roomToGrow';
  vsGood: OLine | null;
  vsTop: OLine;
  headline: OLine | null;
}
export interface OResult {
  metrics: Record<Id, OMetric>;
  overallScore: number | null;
  letter: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  cards: OCard[];
  headlineCard: OCard['id'] | null;
  biggest: Id | null;
}

export function oracle(i: OInputs): OResult {
  /* Section 4: formulas, multiply by 100 before dividing. */
  const net = i.charges3 - i.adjustments3;
  const netRatio = i.charges3 > 0 ? net / i.charges3 : null;
  const daily = i.charges3 / PERIOD_DAYS;
  const val = (num: number | 'unknown', mult: number, den: number): number | null =>
    num === 'unknown' || den === 0 ? null : (num * mult) / den;
  const raw: Record<Id, number | null> = {
    ncr: val(i.payments3, 100, net),
    dar: val(i.totalAR, PERIOD_DAYS, i.charges3),
    ar90: val(i.ar90, 100, i.totalAR),
    den: val(i.claimsDenied3, 100, i.claimsSubmitted3),
    fpr: val(i.claimsPaidFirstPass3, 100, i.claimsSubmitted3),
  };

  /* Section 5: PI rule, scores, statuses, top performer. */
  const pi = i.specialty === 'accident' && i.attorney === true;
  const metrics = {} as Record<Id, OMetric>;
  for (const id of ORDER) {
    const v = raw[id];
    if (v === null) {
      metrics[id] = { availability: 'unavailable', value: null, display: null, score: null, status: null, top: false };
      continue;
    }
    if (pi && (id === 'dar' || id === 'ar90')) {
      metrics[id] = { availability: 'notGraded', value: v, display: round1(v), score: null, status: null, top: false };
      continue;
    }
    const s = score(id, v);
    metrics[id] = { availability: 'graded', value: v, display: round1(v), score: s, status: statusOf(s), top: better(id, v, TOP[id]) };
  }

  /* Overall: integer weights, round once, letter from the rounded value. */
  const graded = ORDER.filter((id) => metrics[id].availability === 'graded');
  let overallScore: number | null = null;
  let letter: OResult['letter'] = null;
  if (graded.length >= 3) {
    const sum = graded.reduce((acc, id) => acc + WEIGHT[id] * metrics[id].score!, 0);
    const wsum = graded.reduce((acc, id) => acc + WEIGHT[id], 0);
    overallScore = round1(sum / wsum);
    letter = overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F';
  }

  /* Section 6: money cards (never for first-pass). */
  const line = (x: number): OLine => ({ rounded: roundMoney(x), under100: roundMoney(x) < 100 });
  const cards: OCard[] = [];
  const make = (id: OCard['id'], metric: Id, gap: (t: number) => number, headline: number | null) => {
    const m = metrics[metric];
    if (m.availability !== 'graded' || m.value === null) return;
    if (!worse(metric, m.value, TOP[metric])) return; // at or better than Top: no card
    const vsTop = line(gap(TOP[metric]));
    if (vsTop.rounded < 100) return; // hidden
    const worseThanGood = worse(metric, m.value, GOOD[metric]);
    cards.push({
      id,
      kind: worseThanGood ? 'gap' : 'roomToGrow',
      vsGood: worseThanGood ? line(gap(GOOD[metric])) : null,
      vsTop,
      headline: headline === null ? null : line(headline),
    });
  };
  if (netRatio !== null) {
    make('uncollected', 'ncr', (t) => (net * 4 * (t - raw.ncr!)) / 100, null);
    make('cashFaster', 'dar', (t) => (raw.dar! - t) * daily * netRatio, null);
    if (i.claimsSubmitted3 > 0 && i.claimsDenied3 !== 'unknown') {
      const denied = i.claimsDenied3;
      const avgNetClaim = (i.charges3 / i.claimsSubmitted3) * netRatio;
      make('deniedAboveTarget', 'den', (t) => ((denied - (t * i.claimsSubmitted3) / 100) / 3) * avgNetClaim, null);
    }
    if (i.ar90 !== 'unknown') {
      const ar90 = i.ar90;
      make('stuckOver90', 'ar90', (t) => (ar90 - (t * i.totalAR) / 100) * netRatio, ar90 * netRatio);
    }
  }

  /* Biggest opportunity: lowest score below 100; ties → higher weight, then display order. */
  let biggest: Id | null = null;
  for (const id of ORDER) {
    const m = metrics[id];
    if (m.availability !== 'graded' || m.score === null || m.score >= 100) continue;
    if (biggest === null) { biggest = id; continue; }
    const b = metrics[biggest].score!;
    // Scores that differ only by floating-point noise (< 1e-9) are a tie, as the spec's rounding rules intend.
    const tie = Math.abs(m.score - b) <= 1e-9;
    if ((!tie && m.score < b) || (tie && WEIGHT[id] > WEIGHT[biggest])) biggest = id;
  }

  return { metrics, overallScore, letter, cards, headlineCard: cards[0]?.id ?? null, biggest };
}

/* ---------- Spec 12.1: offer selection ---------- */
export interface OOfferCfg {
  scorecardBuildEnabled: boolean;
  recoverySprintLive: boolean; // flag on AND a real percentage
  gapToTopEnabled: boolean;
  keepItTopEnabled: boolean;
}
export function oracleOffer(r: OResult, cfg: OOfferCfg): 'scorecardBuild' | 'recoverySprint' | 'gapToTop' | 'keepItTop' | null {
  const fallback = cfg.gapToTopEnabled ? 'gapToTop' : null;
  const notReported = ORDER.filter((id) => r.metrics[id].availability === 'unavailable').length;
  if (notReported >= 2 || r.letter === null) return cfg.scorecardBuildEnabled ? 'scorecardBuild' : fallback;
  if ((r.letter === 'D' || r.letter === 'F') && r.cards.some((c) => c.id === 'stuckOver90') && cfg.recoverySprintLive) return 'recoverySprint';
  if (r.letter === 'A') return cfg.keepItTopEnabled ? 'keepItTop' : fallback;
  return fallback;
}
