import { describe, expect, it } from 'vitest';
import { computeScorecard } from '../compute';
import { GOLDEN_CASES } from './golden.fixtures';

describe.each(GOLDEN_CASES)('$name', ({ inputs, checks }) => {
  const result = computeScorecard(inputs);

  it('passes validation with no errors', () => {
    expect(result.validation.errors).toEqual([]);
  });

  it.each(checks)('$label', ({ expected, actual, mode }) => {
    const got = actual(result);
    if (mode === 'close' && typeof expected === 'number') {
      expect(typeof got).toBe('number');
      expect(got as number).toBeCloseTo(expected, 6);
    } else {
      expect(got).toBe(expected);
    }
  });
});
