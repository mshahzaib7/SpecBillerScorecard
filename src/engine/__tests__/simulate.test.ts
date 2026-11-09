import { describe, expect, it } from 'vitest';
import { METRICS } from '../config';
import { computeScorecard } from '../compute';
import { applySliderChange, CLAIM_SHARE_MAX, simulateScorecard, sliderStartValues, targetSliderValues } from '../simulate';
import { UNKNOWN } from '../types';
import { GOOD_NOT_TOP_INPUTS, STRUGGLING_INPUTS } from './golden.fixtures';

const topLevels = { ncr: METRICS.ncr.topTarget, dar: METRICS.dar.topTarget, ar90: METRICS.ar90.topTarget, den: METRICS.den.topTarget, fpr: METRICS.fpr.topTarget };
const goodLevels = { ncr: METRICS.ncr.goodTarget, dar: METRICS.dar.goodTarget, ar90: METRICS.ar90.goodTarget, den: METRICS.den.goodTarget, fpr: METRICS.fpr.goodTarget };

describe('simulator uses the same engine', () => {
  it('no overrides → identical to the reveal', () => {
    expect(simulateScorecard(STRUGGLING_INPUTS, {})).toEqual(computeScorecard(STRUGGLING_INPUTS));
  });

  it('sliders at the user\'s exact values → identical to the reveal', () => {
    const reveal = computeScorecard(STRUGGLING_INPUTS);
    const at = Object.fromEntries(Object.values(reveal.metrics).map((m) => [m.id, m.value!]));
    expect(simulateScorecard(STRUGGLING_INPUTS, at)).toEqual(reveal);
  });

  it('a simulated metric gives the same result as entering equivalent report numbers', () => {
    // NCR 96% ⇔ payments 172,800 with these charges
    const sim = simulateScorecard(STRUGGLING_INPUTS, { ncr: 96 });
    const real = computeScorecard({ ...STRUGGLING_INPUTS, payments3: 172_800 });
    expect(sim.metrics.ncr.score).toBeCloseTo(real.metrics.ncr.score!, 9);
    expect(sim.overall).toEqual(real.overall);
    expect(sim.moneyCards.map((c) => c.vsTop.rounded)).toEqual(real.moneyCards.map((c) => c.vsTop.rounded));
  });

  it('"Show me top-performer levels" → A, 100, no money cards (golden 1)', () => {
    const r = simulateScorecard(STRUGGLING_INPUTS, topLevels);
    expect(r.overall.score).toBe(100);
    expect(r.overall.letter).toBe('A');
    expect(r.moneyCards).toEqual([]);
    expect(Object.values(r.metrics).every((m) => m.topPerformer)).toBe(true);
  });

  it('"Show me Good levels" → every metric exactly Good (85), grade B, vs-Good lines gone', () => {
    const r = simulateScorecard(STRUGGLING_INPUTS, goodLevels);
    for (const m of Object.values(r.metrics)) {
      expect(m.score).toBeCloseTo(85, 9);
      expect(m.status).toBe('good');
    }
    expect(r.overall.score).toBe(85);
    expect(r.overall.letter).toBe('B');
    expect(r.moneyCards.every((c) => c.kind === 'roomToGrow' && c.vsGood === null)).toBe(true);
  });

  it('DAR slider holds the AR-over-90 percentage', () => {
    const r = simulateScorecard(STRUGGLING_INPUTS, { dar: 30 });
    expect(r.metrics.dar.value).toBeCloseTo(30, 9);
    expect(r.metrics.ar90.value).toBeCloseTo(25, 9);
  });

  it('unavailable metrics cannot be overridden', () => {
    const inputs = { ...STRUGGLING_INPUTS, claimsDenied3: UNKNOWN };
    const r = simulateScorecard(inputs, { den: 3 });
    expect(r.metrics.den.availability).toBe('unavailable');
  });

  it('golden 4 at top levels → no money cards', () => {
    expect(simulateScorecard(GOOD_NOT_TOP_INPUTS, topLevels).moneyCards).toEqual([]);
  });
});

describe('denial % + first-pass % ≤ 100 in the simulator', () => {
  it('moving denial up pushes first-pass back to keep the total at 100', () => {
    expect(applySliderChange({ den: 3, fpr: 97 }, 'den', 10)).toEqual({ den: 10, fpr: 90 });
  });

  it('moving first-pass up pushes denial back to keep the total at 100', () => {
    expect(applySliderChange({ den: 12, fpr: 84 }, 'fpr', 97)).toEqual({ den: 3, fpr: 97 });
  });

  it('no change to the other slider when the total stays ≤ 100', () => {
    expect(applySliderChange({ den: 12, fpr: 84 }, 'fpr', 88)).toEqual({ den: 12, fpr: 88 });
    expect(applySliderChange({ den: 12, fpr: 84 }, 'den', 16)).toEqual({ den: 16, fpr: 84 });
  });

  it('other sliders are never touched by the pair rule', () => {
    expect(applySliderChange({ ncr: 92.5, den: 12, fpr: 84 }, 'ncr', 98)).toEqual({ ncr: 98, den: 12, fpr: 84 });
  });

  it('Good and Top presets both total exactly 100 or less', () => {
    const r = computeScorecard(STRUGGLING_INPUTS);
    for (const level of ['good', 'top'] as const) {
      const t = targetSliderValues(r, level);
      expect(t.den! + t.fpr!).toBeLessThanOrEqual(CLAIM_SHARE_MAX);
    }
  });

  it('safety net: simulateScorecard never produces denial + first-pass above 100', () => {
    const r = simulateScorecard(STRUGGLING_INPUTS, { den: 20, fpr: 95 });
    expect(r.metrics.den.value! + r.metrics.fpr.value!).toBeCloseTo(100, 9);
  });

  it('slider start values = user values for graded metrics only', () => {
    const r = computeScorecard({ ...STRUGGLING_INPUTS, claimsDenied3: UNKNOWN });
    expect(Object.keys(sliderStartValues(r)).sort()).toEqual(['ar90', 'dar', 'fpr', 'ncr']);
  });
});
