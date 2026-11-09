/**
 * Scores, statuses and letter grades (spec section 5).
 */
import { LETTER_THRESHOLDS, STATUS_THRESHOLDS, type Anchor, type Direction } from './config';
import { gte, lte } from './math';
import type { OverallResult, Status } from './types';

/**
 * Piecewise-linear interpolation between anchors (sorted by ascending value),
 * clamped at both ends. Multiplies before dividing.
 */
export function scoreFromAnchors(value: number, anchors: readonly Anchor[]): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (!first || !last) throw new Error('A metric needs at least one anchor');
  if (value <= first.value) return first.score;
  if (value >= last.value) return last.score;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (value === a.value) return a.score;
    if (value === b.value) return b.score;
    if (value > a.value && value < b.value) {
      return a.score + ((value - a.value) * (b.score - a.score)) / (b.value - a.value);
    }
  }
  return last.score; // unreachable for sorted anchors
}

/** Status is derived ONLY from the score. */
export function statusFromScore(score: number): Status {
  if (gte(score, STATUS_THRESHOLDS.good)) return 'good';
  if (gte(score, STATUS_THRESHOLDS.watch)) return 'watch';
  return 'problem';
}

/** True when `value` meets or beats `target` in the metric's direction. */
export function meetsTarget(value: number, target: number, direction: Direction): boolean {
  return direction === 'higherIsBetter' ? gte(value, target) : lte(value, target);
}

/** Letter from the already-rounded overall score. */
export function letterFromScore(roundedScore: number): NonNullable<OverallResult['letter']> {
  for (const t of LETTER_THRESHOLDS) {
    if (roundedScore >= t.min) return t.letter;
  }
  return 'F';
}
