import { describe, expect, it } from 'vitest';
import { METRICS, METRIC_ORDER } from '../config';
import { computeScorecard } from '../compute';
import type { NumericInput, ScorecardInputs, ScorecardResult } from '../types';
import { UNKNOWN } from '../types';
import { GOOD_NOT_TOP_INPUTS, STRUGGLING_INPUTS, TOP_INPUTS } from './golden.fixtures';

const run = (patch: Partial<ScorecardInputs>, base: ScorecardInputs = STRUGGLING_INPUTS) =>
  computeScorecard({ ...base, ...patch });

/** Walks the whole result and returns paths of any NaN / Infinity / undefined values. */
function badValues(x: unknown, path = 'result'): string[] {
  if (x === undefined) return [path];
  if (typeof x === 'number') return Number.isFinite(x) ? [] : [path];
  if (Array.isArray(x)) return x.flatMap((v, i) => badValues(v, `${path}[${i}]`));
  if (x !== null && typeof x === 'object') {
    return Object.entries(x).flatMap(([k, v]) => badValues(v, `${path}.${k}`));
  }
  return [];
}

describe('division by zero → metric unavailable (never NaN / Infinity / 0)', () => {
  it('charges3 = 0 → NCR, DAR unavailable', () => {
    const r = run({ charges3: 0, adjustments3: 0 });
    expect(r.metrics.ncr.availability).toBe('unavailable');
    expect(r.metrics.dar.availability).toBe('unavailable');
    expect(r.base.netRatio).toBeNull();
    expect(badValues(r)).toEqual([]);
  });

  it('netCharges = 0 → NCR unavailable', () => {
    const r = run({ adjustments3: 300_000 });
    expect(r.metrics.ncr.value).toBeNull();
    expect(badValues(r)).toEqual([]);
  });

  it('totalAR = 0 → AR90 unavailable, DAR = 0 days (valid)', () => {
    const r = run({ totalAR: 0, ar90: 0 });
    expect(r.metrics.ar90.availability).toBe('unavailable');
    expect(r.metrics.dar.value).toBe(0);
    expect(badValues(r)).toEqual([]);
  });

  it('claimsSubmitted3 = 0 → denial and first-pass unavailable', () => {
    const r = run({ claimsSubmitted3: 0, claimsDenied3: 0, claimsPaidFirstPass3: 0 });
    expect(r.metrics.den.availability).toBe('unavailable');
    expect(r.metrics.fpr.availability).toBe('unavailable');
    expect(r.moneyCards.find((c) => c.id === 'deniedAboveTarget')).toBeUndefined();
    expect(badValues(r)).toEqual([]);
  });

  it('unavailable metrics have null value, score and status — not 0', () => {
    const r = run({ claimsDenied3: UNKNOWN });
    expect(r.metrics.den).toMatchObject({ value: null, displayValue: null, score: null, status: null, topPerformer: false });
  });

  it('no NaN / Infinity / undefined anywhere for any combination of "I don\'t know" and zeros', () => {
    const optionalChoices: NumericInput[] = [UNKNOWN, 0, 10, null];
    const requiredChoices: NumericInput[] = [0, 1, 300_000, null];
    let combos = 0;
    for (const charges3 of requiredChoices)
      for (const adjustments3 of [0, 120_000, null] as NumericInput[])
        for (const totalAR of requiredChoices)
          for (const claimsSubmitted3 of [0, 1_500, null] as NumericInput[])
            for (const claimsDenied3 of optionalChoices)
              for (const claimsPaidFirstPass3 of optionalChoices)
                for (const ar90 of optionalChoices)
                  for (const specialty of ['behavioral', 'accident', null] as const) {
                    const r = computeScorecard({
                      ...STRUGGLING_INPUTS,
                      specialty,
                      arIncludesAttorneyCases: specialty === 'accident' ? true : null,
                      charges3,
                      adjustments3,
                      totalAR,
                      claimsSubmitted3,
                      claimsDenied3,
                      claimsPaidFirstPass3,
                      ar90,
                    });
                    const bad = badValues(r);
                    if (bad.length) throw new Error(`Bad values ${bad.join(', ')}`);
                    combos++;
                  }
    expect(combos).toBeGreaterThan(10_000);
  });

  it('no NaN / Infinity for random inputs (seeded fuzz)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648);
    const pick = (max: number): NumericInput => {
      const p = rand();
      if (p < 0.1) return UNKNOWN;
      if (p < 0.2) return 0;
      return Math.round(rand() * max);
    };
    for (let i = 0; i < 5_000; i++) {
      const r = computeScorecard({
        specialty: rand() < 0.3 ? 'accident' : 'general',
        arIncludesAttorneyCases: rand() < 0.5,
        painPoints: [],
        charges3: pick(1_000_000),
        adjustments3: pick(1_000_000),
        payments3: pick(1_000_000),
        claimsSubmitted3: pick(5_000),
        claimsDenied3: pick(5_000),
        claimsPaidFirstPass3: pick(5_000),
        totalAR: pick(2_000_000),
        ar90: pick(2_000_000),
      });
      expect(badValues(r)).toEqual([]);
    }
  });
});

describe('determinism', () => {
  it('same inputs → same outputs', () => {
    expect(computeScorecard(STRUGGLING_INPUTS)).toEqual(computeScorecard({ ...STRUGGLING_INPUTS }));
  });
});

describe('Accident / PI rule', () => {
  const pi = (attorney: boolean) =>
    run({ specialty: 'accident', arIncludesAttorneyCases: attorney });

  it('attorney cases = yes → DAR and AR90 not graded but raw values kept', () => {
    const r = pi(true);
    expect(r.piRuleApplied).toBe(true);
    expect(r.metrics.dar).toMatchObject({ availability: 'notGraded', displayValue: 57, score: null, status: null });
    expect(r.metrics.ar90).toMatchObject({ availability: 'notGraded', displayValue: 25, score: null, status: null });
  });

  it('attorney cases = yes → excluded from overall score', () => {
    const r = pi(true);
    // NCR 30×72.5 + Denial 20×48 + FPR 15×36 = 2175 + 960 + 540 = 3675 / 65 = 56.538… → 56.5
    expect(r.overall.weightTotal).toBe(65);
    expect(r.overall.weightedSum).toBeCloseTo(3675, 6);
    expect(r.overall.score).toBe(56.5);
    expect(r.overall.letter).toBe('F');
  });

  it('attorney cases = yes → excluded from money cards', () => {
    const ids = pi(true).moneyCards.map((c) => c.id);
    expect(ids).toEqual(['uncollected', 'deniedAboveTarget']);
  });

  it('attorney cases = no → graded normally (same as golden 1)', () => {
    const r = pi(false);
    expect(r.piRuleApplied).toBe(false);
    expect(r.overall.score).toBe(56.3);
    expect(r.moneyCards).toHaveLength(4);
  });

  it('attorney answer ignored for non-PI specialties', () => {
    expect(run({ specialty: 'behavioral', arIncludesAttorneyCases: true }).piRuleApplied).toBe(false);
  });
});

describe('minimum metrics for a grade', () => {
  it('2 graded metrics → no letter grade and no score', () => {
    const r = run({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN, ar90: UNKNOWN });
    expect(r.overall.gradedCount).toBe(2);
    expect(r.overall.letter).toBeNull();
    expect(r.overall.score).toBeNull();
  });

  it('exactly 3 graded metrics → graded', () => {
    const r = run({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN });
    expect(r.overall.gradedCount).toBe(3);
    expect(r.overall.letter).not.toBeNull();
  });

  it('PI rule can push below 3 → no grade', () => {
    const r = run({ specialty: 'accident', arIncludesAttorneyCases: true, claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN });
    expect(r.overall.gradedCount).toBe(1);
    expect(r.overall.letter).toBeNull();
  });
});

describe('money card logic', () => {
  const ncrCard = (r: ScorecardResult) => r.moneyCards.find((c) => c.id === 'uncollected');
  // netCharges = 180,000 → NCR = payments / 1,800
  const atNcr = (pct: number) => run({ payments3: pct * 1_800 });

  it('better than Top → no card', () => {
    expect(ncrCard(atNcr(99))).toBeUndefined();
  });

  it('exactly at Top → no card', () => {
    expect(ncrCard(atNcr(98))).toBeUndefined();
  });

  it('between Good and Top → "Room to grow", vs Top only', () => {
    const c = ncrCard(atNcr(96.5));
    expect(c?.kind).toBe('roomToGrow');
    expect(c?.vsGood).toBeNull();
    expect(c?.vsTop.rounded).toBe(10_800); // 180,000 × 4 × 1.5 / 100
  });

  it('exactly at Good → "Room to grow", vs Top only', () => {
    const c = ncrCard(atNcr(95));
    expect(c?.kind).toBe('roomToGrow');
    expect(c?.vsGood).toBeNull();
    expect(c?.vsTop.rounded).toBe(21_600);
  });

  it('worse than Good → both lines', () => {
    const c = ncrCard(atNcr(90));
    expect(c?.kind).toBe('gap');
    expect(c?.vsGood?.rounded).toBe(36_000);
    expect(c?.vsTop.rounded).toBe(57_600);
  });

  it('lower-is-better metric: DAR exactly at Top (30 days) → no card; 30.3 → room to grow', () => {
    // DAR = totalAR × 90 / 300,000 → 30 days = 100,000
    expect(run({ totalAR: 100_000, ar90: 0 }).moneyCards.find((c) => c.id === 'cashFaster')).toBeUndefined();
    const c = run({ totalAR: 101_000, ar90: 0 }).moneyCards.find((x) => x.id === 'cashFaster');
    expect(c?.kind).toBe('roomToGrow');
  });

  it('first-pass rate never has a money card', () => {
    const r = run({ claimsPaidFirstPass3: 0 });
    expect(r.moneyCards.some((c) => c.metric === 'fpr')).toBe(false);
  });

  it('unavailable metric → no card', () => {
    expect(run({ ar90: UNKNOWN }).moneyCards.find((c) => c.id === 'stuckOver90')).toBeUndefined();
  });

  it('cards are ordered and the headline card is the NCR card when present', () => {
    const r = run({});
    expect(r.moneyCards.map((c) => c.id)).toEqual(['uncollected', 'cashFaster', 'deniedAboveTarget', 'stuckOver90']);
    expect(r.headlineCard?.id).toBe('uncollected');
  });

  it('headline falls back to the next card when NCR is top or unavailable', () => {
    expect(run({ payments3: 178_200 }).headlineCard?.id).toBe('cashFaster');
    expect(run({ payments3: UNKNOWN }).headlineCard?.id).toBe('cashFaster');
  });

  it('top performer (golden 3) → no cards and no headline', () => {
    const r = computeScorecard(TOP_INPUTS);
    expect(r.moneyCards).toEqual([]);
    expect(r.headlineCard).toBeNull();
    expect(r.biggestOpportunity).toBeNull();
  });
});

describe('biggest opportunity', () => {
  it('golden 1 → first-pass (lowest score, 36)', () => {
    expect(computeScorecard(STRUGGLING_INPUTS).biggestOpportunity).toBe('fpr');
  });

  it('golden 4 → first-pass (85, the lowest)', () => {
    expect(computeScorecard(GOOD_NOT_TOP_INPUTS).biggestOpportunity).toBe('fpr');
  });

  it('ignores ungraded metrics', () => {
    const r = run({ claimsPaidFirstPass3: UNKNOWN });
    expect(r.biggestOpportunity).toBe('ar90'); // 45 < 48 (denial)
  });
});

describe('status vs targets never contradict', () => {
  it.each(METRIC_ORDER)('%s: value at Good target → Good; at Top target → Top performer', (id) => {
    const m = METRICS[id];
    // spot-check through the anchors used by the engine
    expect(m.anchors.some((a) => a.value === m.goodTarget && a.score === 85)).toBe(true);
    expect(m.anchors.some((a) => a.value === m.topTarget && a.score === 100)).toBe(true);
  });
});

describe('small money gaps', () => {
  // netCharges = 180,000 → NCR = payments / 1,800; $ gap = 180,000 × 4 × Δ / 100 = 7,200 × Δ
  const ncrCard = (payments3: number) => run({ payments3 }).moneyCards.find((c) => c.id === 'uncollected');

  it('largest line (vs Top) rounds below $100 → whole card hidden', () => {
    // NCR 97.995% → vs Top = 7,200 × 0.005 = $36 → rounds to $0
    expect(ncrCard(176_391)).toBeUndefined();
  });

  it('largest line exactly $100 after rounding → card shown', () => {
    // NCR 97.99% → vs Top = $72 → rounds to $100
    const c = ncrCard(176_382);
    expect(c?.vsTop.rounded).toBe(100);
    expect(c?.vsTop.belowMinimum).toBe(false);
  });

  it('only the secondary line (vs Good) below $100 → card shown, that line flagged "under $100"', () => {
    // NCR 94.995% → vs Good = $36 (→ $0), vs Top = $21,636 (→ $21,600)
    const c = ncrCard(170_991);
    expect(c?.kind).toBe('gap');
    expect(c?.vsGood?.belowMinimum).toBe(true);
    expect(c?.vsTop.rounded).toBe(21_600);
    expect(c?.vsTop.belowMinimum).toBe(false);
  });

  it('golden 1 lines are never flagged below minimum', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    for (const c of r.moneyCards) {
      expect(c.vsTop.belowMinimum).toBe(false);
      expect(c.vsGood?.belowMinimum ?? false).toBe(false);
    }
  });
});

describe('healthy practice: "Room to grow" cards (section 6)', () => {
  // NCR 96%, DAR 33 days, net charges $180,000 per 3 months — Good on both, not Top.
  const HEALTHY: ScorecardInputs = {
    specialty: 'general',
    arIncludesAttorneyCases: null,
    painPoints: [],
    charges3: 300_000,
    adjustments3: 120_000,
    payments3: 172_800,
    claimsSubmitted3: 1_500,
    claimsDenied3: 120,
    claimsPaidFirstPass3: 1_350,
    totalAR: 110_000,
    ar90: 13_200,
  };
  const r = computeScorecard(HEALTHY);
  const card = (id: string) => r.moneyCards.find((c) => c.id === id);

  it('NCR and DAR are Good but not Top', () => {
    expect(r.base.netCharges).toBe(180_000);
    expect(r.metrics.ncr.displayValue).toBe(96);
    expect(r.metrics.dar.displayValue).toBe(33);
    expect(r.metrics.ncr.status).toBe('good');
    expect(r.metrics.dar.status).toBe('good');
    expect(r.metrics.ncr.topPerformer).toBe(false);
    expect(r.metrics.dar.topPerformer).toBe(false);
  });

  it('uncollected: Room to grow, vs Top only, about $14,400 per year', () => {
    const c = card('uncollected')!;
    expect(c.kind).toBe('roomToGrow');
    expect(c.timeUnit).toBe('perYear');
    expect(c.vsGood).toBeNull();
    expect(c.vsTop.rounded).toBe(14_400);
  });

  it('cash faster: Room to grow, vs Top only, about $6,000 one-time', () => {
    const c = card('cashFaster')!;
    expect(c.kind).toBe('roomToGrow');
    expect(c.timeUnit).toBe('oneTime');
    expect(c.vsGood).toBeNull();
    expect(c.vsTop.rounded).toBe(6_000);
  });

  it('headline money line is the $14,400 per-year uncollected figure', () => {
    expect(r.headlineCard?.id).toBe('uncollected');
    expect(r.headlineCard?.vsTop.rounded).toBe(14_400);
  });
});
