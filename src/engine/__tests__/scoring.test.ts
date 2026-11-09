import { describe, expect, it } from 'vitest';
import { METRICS, METRIC_ORDER, STATUS_THRESHOLDS } from '../config';
import { round1, roundMoney } from '../math';
import { letterFromScore, scoreFromAnchors, statusFromScore } from '../scoring';

describe('config consistency', () => {
  it('weights sum to exactly 100 and are integers', () => {
    const weights = METRIC_ORDER.map((id) => METRICS[id].weight);
    expect(weights.every(Number.isInteger)).toBe(true);
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it.each(METRIC_ORDER)('%s: Good target = score-85 anchor, Top target = score-100 anchor', (id) => {
    const m = METRICS[id];
    expect(m.anchors.find((a) => a.score === STATUS_THRESHOLDS.good)?.value).toBe(m.goodTarget);
    expect(m.anchors.find((a) => a.score === 100)?.value).toBe(m.topTarget);
  });

  it.each(METRIC_ORDER)('%s: anchors are sorted by ascending value', (id) => {
    const values = METRICS[id].anchors.map((a) => a.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});

describe('scoreFromAnchors', () => {
  describe.each(METRIC_ORDER)('%s', (id) => {
    const anchors = METRICS[id].anchors;
    const first = anchors[0]!;
    const last = anchors[anchors.length - 1]!;

    it.each(anchors.map((a) => [a.value, a.score] as const))('anchor %d → exactly %d', (value, score) => {
      expect(scoreFromAnchors(value, anchors)).toBe(score);
    });

    it('clamps beyond both ends', () => {
      expect(scoreFromAnchors(first.value - 1000, anchors)).toBe(first.score);
      expect(scoreFromAnchors(last.value + 1000, anchors)).toBe(last.score);
      expect(scoreFromAnchors(first.value - 0.0001, anchors)).toBe(first.score);
      expect(scoreFromAnchors(last.value + 0.0001, anchors)).toBe(last.score);
    });

    it('stays within 0–100 for many values', () => {
      for (let v = first.value - 50; v <= last.value + 50; v += 0.37) {
        const s = scoreFromAnchors(v, anchors);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
    });
  });

  it('interpolates linearly between anchors', () => {
    expect(scoreFromAnchors(92.5, METRICS.ncr.anchors)).toBeCloseTo(72.5, 6);
    expect(scoreFromAnchors(57, METRICS.dar.anchors)).toBeCloseTo(63.75, 6);
    expect(scoreFromAnchors(31.5, METRICS.dar.anchors)).toBeCloseTo(97.75, 6);
  });
});

describe('statusFromScore', () => {
  it.each([
    [100, 'good'],
    [85, 'good'],
    [84.99, 'watch'],
    [60, 'watch'],
    [59.99, 'problem'],
    [0, 'problem'],
  ] as const)('score %d → %s', (score, status) => {
    expect(statusFromScore(score)).toBe(status);
  });
});

describe('letterFromScore', () => {
  it.each([
    [100, 'A'],
    [90.0, 'A'],
    [89.9, 'B'],
    [80.0, 'B'],
    [79.9, 'C'],
    [70.0, 'C'],
    [69.9, 'D'],
    [60.0, 'D'],
    [59.9, 'F'],
    [0, 'F'],
  ] as const)('%d → %s', (score, letter) => {
    expect(letterFromScore(score)).toBe(letter);
  });
});

describe('rounding helpers', () => {
  it('round1 rounds half up and absorbs float drift', () => {
    expect(round1(56.25)).toBe(56.3);
    expect(round1(5085 / 85)).toBe(59.8);
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(1.05)).toBe(1.1);
  });

  it('roundMoney rounds to the nearest $100', () => {
    expect(roundMoney(7560)).toBe(7600);
    expect(roundMoney(1260)).toBe(1300);
    expect(roundMoney(1249.99)).toBe(1200);
    expect(roundMoney(1250)).toBe(1300);
    expect(roundMoney(39_600.000000001)).toBe(39_600);
  });
});
