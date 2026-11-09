/**
 * QA section B (engine level): the hand-calculated tables from the QA checklist, checked against
 * BOTH the independent oracle and the real engine. Scores and weighted sums are not shown in the
 * UI, so this is where they are verified; everything visible is also read off the UI separately.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeScorecard, selectOffer, UNKNOWN, type ScorecardInputs } from '../src/engine';
import { oracle, type OInputs } from './oracle';

type Row = { value: number; score?: number; status: string | null; graded?: boolean };
interface Case {
  name: string;
  inp: OInputs;
  metrics: Partial<Record<'ncr' | 'dar' | 'ar90' | 'den' | 'fpr', Row | 'notReported'>>;
  overall: number | null;
  letter: string | null;
  weighted?: [number, number];
  top: Record<string, number>;
  good: Record<string, number | null>;
  headline?: number;
  biggest?: string;
  offer: string;
}

const CASES: Case[] = [
  {
    name: 'QA-1 primary care, every metric in Watch',
    inp: { specialty: 'general', attorney: null, charges3: 250_000, adjustments3: 100_000, payments3: 139_500, claimsSubmitted3: 2_000, claimsDenied3: 140, claimsPaidFirstPass3: 1_820, totalAR: 125_000, ar90: 22_500 },
    metrics: { ncr: { value: 93, score: 75, status: 'watch' }, dar: { value: 45, score: 78.75, status: 'watch' }, ar90: { value: 18, score: 70, status: 'watch' }, den: { value: 7, score: 75, status: 'watch' }, fpr: { value: 91, score: 65, status: 'watch' } },
    overall: 73.5, letter: 'C', weighted: [7350, 100],
    top: { uncollected: 30_000, cashFaster: 25_000, deniedAboveTarget: 2_000, stuckOver90: 6_000 },
    good: { uncollected: 12_000, cashFaster: 8_300, deniedAboveTarget: 1_000, stuckOver90: 2_300 },
    headline: 13_500, biggest: 'fpr', offer: 'gapToTop',
  },
  {
    name: 'QA-2 accident/PI with attorney cases',
    inp: { specialty: 'accident', attorney: true, charges3: 400_000, adjustments3: 160_000, payments3: 223_200, claimsSubmitted3: 800, claimsDenied3: 72, claimsPaidFirstPass3: 672, totalAR: 520_000, ar90: 210_000 },
    metrics: { ncr: { value: 93, score: 75, status: 'watch' }, dar: { value: 117, status: null, graded: false }, ar90: { value: 40.4, status: null, graded: false }, den: { value: 9, score: 65, status: 'watch' }, fpr: { value: 84, score: 36, status: 'problem' } },
    overall: 62.9, letter: 'D', weighted: [4090, 65],
    top: { uncollected: 48_000, deniedAboveTarget: 4_800 },
    good: { uncollected: 19_200, deniedAboveTarget: 3_200 },
    offer: 'gapToTop',
  },
  {
    name: 'QA-3 every number exactly on the Good target',
    inp: { specialty: 'behavioral', attorney: null, charges3: 360_000, adjustments3: 144_000, payments3: 205_200, claimsSubmitted3: 1_000, claimsDenied3: 50, claimsPaidFirstPass3: 950, totalAR: 160_000, ar90: 24_000 },
    metrics: { ncr: { value: 95, score: 85, status: 'good' }, dar: { value: 40, score: 85, status: 'good' }, ar90: { value: 15, score: 85, status: 'good' }, den: { value: 5, score: 85, status: 'good' }, fpr: { value: 95, score: 85, status: 'good' } },
    overall: 85, letter: 'B',
    top: { uncollected: 25_900, cashFaster: 24_000, deniedAboveTarget: 1_400, stuckOver90: 4_800 },
    good: { uncollected: null, cashFaster: null, deniedAboveTarget: null, stuckOver90: null },
    headline: 14_400, biggest: 'ncr', offer: 'gapToTop',
  },
  {
    name: 'QA-4 only 2 numbers (no grade)',
    inp: { specialty: 'other', attorney: null, charges3: 200_000, adjustments3: 80_000, payments3: 110_400, claimsSubmitted3: 500, claimsDenied3: 'unknown', claimsPaidFirstPass3: 'unknown', totalAR: 100_000, ar90: 'unknown' },
    metrics: { ncr: { value: 92, status: 'watch' }, dar: { value: 45, status: 'watch' }, ar90: 'notReported', den: 'notReported', fpr: 'notReported' },
    overall: null, letter: null,
    top: { uncollected: 28_800, cashFaster: 20_000 },
    good: { uncollected: 14_400, cashFaster: 6_700 },
    offer: 'scorecardBuild',
  },
];

const toEngine = (i: OInputs): ScorecardInputs => ({
  specialty: i.specialty, arIncludesAttorneyCases: i.attorney, painPoints: [],
  charges3: i.charges3, adjustments3: i.adjustments3, payments3: i.payments3, claimsSubmitted3: i.claimsSubmitted3,
  claimsDenied3: i.claimsDenied3 === 'unknown' ? UNKNOWN : i.claimsDenied3,
  claimsPaidFirstPass3: i.claimsPaidFirstPass3 === 'unknown' ? UNKNOWN : i.claimsPaidFirstPass3,
  totalAR: i.totalAR, ar90: i.ar90 === 'unknown' ? UNKNOWN : i.ar90,
});

describe('QA B (engine level): hand-calculated cases', () => {
  const lines: string[] = [];
  for (const c of CASES) {
    it(c.name, () => {
      const o = oracle(c.inp);
      const e = computeScorecard(toEngine(c.inp));
      const fails: string[] = [];
      const check = (what: string, expected: unknown, oracleV: unknown, engineV: unknown) => {
        const ok = JSON.stringify(expected) === JSON.stringify(oracleV) && JSON.stringify(expected) === JSON.stringify(engineV);
        lines.push(`${ok ? 'PASS' : 'FAIL'} | ${c.name} | ${what} | expected ${JSON.stringify(expected)} | oracle ${JSON.stringify(oracleV)} | engine ${JSON.stringify(engineV)}`);
        if (!ok) fails.push(what);
      };
      for (const [id, row] of Object.entries(c.metrics)) {
        const om = o.metrics[id as keyof typeof o.metrics];
        const em = e.metrics[id as keyof typeof e.metrics];
        if (row === 'notReported') {
          check(`${id} availability`, 'unavailable', om.availability, em.availability);
          continue;
        }
        check(`${id} value`, row.value, om.display, em.displayValue);
        check(`${id} status`, row.status, om.status, em.status);
        if (row.score !== undefined) check(`${id} score`, row.score, Math.round(om.score! * 1e9) / 1e9, Math.round(em.score! * 1e9) / 1e9);
        if (row.graded === false) check(`${id} graded`, 'notGraded', om.availability, em.availability);
      }
      check('overall score', c.overall, o.overallScore, e.overall.score);
      check('letter', c.letter, o.letter, e.overall.letter);
      if (c.weighted) {
        // The oracle does not expose the raw sum, so this row compares expected vs engine only.
        const ew = [Math.round(e.overall.weightedSum * 1e6) / 1e6, e.overall.weightTotal];
        check('weighted sum / weights (engine)', c.weighted, ew, ew);
      }
      check('cards shown', Object.keys(c.top), o.cards.map((x) => x.id), e.moneyCards.map((x) => x.id));
      for (const [id, v] of Object.entries(c.top)) {
        const oc = o.cards.find((x) => x.id === id);
        const ec = e.moneyCards.find((x) => x.id === id);
        check(`${id} vs Top`, v, oc?.vsTop.rounded, ec?.vsTop.rounded);
        check(`${id} vs Good`, c.good[id], oc?.vsGood?.rounded ?? null, ec?.vsGood?.rounded ?? null);
      }
      if (c.headline !== undefined) check('over-90 stuck now', c.headline, o.cards.find((x) => x.id === 'stuckOver90')?.headline?.rounded, e.moneyCards.find((x) => x.id === 'stuckOver90')?.headline?.rounded);
      if (c.biggest) check('biggest opportunity', c.biggest, o.biggest, e.biggestOpportunity);
      check('offer (real config)', c.offer, c.offer, selectOffer(e));
      expect(fails).toEqual([]);
      writeFileSync('qa/hand-results.txt', lines.join('\n'));
    });
  }
});
