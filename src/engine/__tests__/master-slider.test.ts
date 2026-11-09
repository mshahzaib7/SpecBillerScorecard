import { describe, expect, it } from 'vitest';
import { METRIC_ORDER, METRICS } from '../config';
import { computeScorecard } from '../compute';
import { CLAIM_SHARE_MAX, masterSliderOverrides, simulateScorecard, targetSliderValues } from '../simulate';
import { UNKNOWN, type MetricId } from '../types';
import { GOLDEN_CASES, GOOD_NOT_TOP_INPUTS, STRUGGLING_INPUTS } from './golden.fixtures';

const STEPS = Array.from({ length: 41 }, (_, i) => i / 40);
const better = (id: MetricId, a: number, b: number) =>
  METRICS[id].direction === 'higherIsBetter' ? a >= b - 1e-9 : a <= b + 1e-9;

describe('masterSliderOverrides (DESIGN-BRIEF 7.9)', () => {
  it('t = 0 reproduces the scorecard exactly', () => {
    for (const inputs of [STRUGGLING_INPUTS, GOOD_NOT_TOP_INPUTS, ...GOLDEN_CASES.map((c) => c.inputs)]) {
      const r = computeScorecard(inputs);
      expect(simulateScorecard(inputs, masterSliderOverrides(r, 0))).toEqual(r);
    }
  });

  it('t = 1 equals the top-level overrides', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    expect(masterSliderOverrides(r, 1)).toEqual(targetSliderValues(r, 'top'));
    const sim = simulateScorecard(STRUGGLING_INPUTS, masterSliderOverrides(r, 1));
    expect(sim).toEqual(simulateScorecard(STRUGGLING_INPUTS, targetSliderValues(r, 'top')));
    expect(sim.overall.score).toBe(100);
    expect(sim.overall.letter).toBe('A');
  });

  it('is monotonic: every metric, the score and the yearly gap only improve as t grows', () => {
    for (const inputs of [STRUGGLING_INPUTS, GOOD_NOT_TOP_INPUTS]) {
      const r = computeScorecard(inputs);
      let prev = masterSliderOverrides(r, 0);
      let prevScore = r.overall.score!;
      let prevGap = r.moneyCards.find((c) => c.id === 'uncollected')?.vsTop.raw ?? 0;
      for (const t of STEPS.slice(1)) {
        const o = masterSliderOverrides(r, t);
        for (const id of Object.keys(o) as MetricId[]) expect(better(id, o[id]!, prev[id]!)).toBe(true);
        const sim = simulateScorecard(inputs, o);
        expect(sim.overall.score!).toBeGreaterThanOrEqual(prevScore);
        const gap = sim.moneyCards.find((c) => c.id === 'uncollected')?.vsTop.raw ?? 0;
        expect(gap).toBeLessThanOrEqual(prevGap + 1e-9);
        prev = o;
        prevScore = sim.overall.score!;
        prevGap = gap;
      }
    }
  });

  it('keeps denial % + first-pass % at or below 100 for every t', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    for (const t of STEPS) {
      const o = masterSliderOverrides(r, t);
      expect(o.den! + o.fpr!).toBeLessThanOrEqual(CLAIM_SHARE_MAX + 1e-9);
    }
  });

  it('every metric moves by the same share of its distance to Top', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    const o = masterSliderOverrides(r, 0.5);
    for (const id of METRIC_ORDER) {
      const v = r.metrics[id].value!;
      expect(o[id]).toBeCloseTo(v + (METRICS[id].topTarget - v) * 0.5, 9);
    }
  });

  it('a metric already better than Top is held, never made worse', () => {
    // Payments raised so net collection rate is 99% (Top is 98%).
    const inputs = { ...STRUGGLING_INPUTS, payments3: 178_200 };
    const r = computeScorecard(inputs);
    for (const t of STEPS) expect(masterSliderOverrides(r, t).ncr).toBeCloseTo(99, 9);
    expect(simulateScorecard(inputs, masterSliderOverrides(r, 1)).overall.score).toBe(100);
  });

  it('only graded metrics are included', () => {
    const r = computeScorecard({ ...STRUGGLING_INPUTS, claimsDenied3: UNKNOWN });
    expect(Object.keys(masterSliderOverrides(r, 0.5)).sort()).toEqual(['ar90', 'dar', 'fpr', 'ncr']);
  });

  it('clamps t outside 0..1 and treats NaN as 0', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    expect(masterSliderOverrides(r, -2)).toEqual(masterSliderOverrides(r, 0));
    expect(masterSliderOverrides(r, 7)).toEqual(masterSliderOverrides(r, 1));
    expect(masterSliderOverrides(r, Number.NaN)).toEqual(masterSliderOverrides(r, 0));
  });
});
