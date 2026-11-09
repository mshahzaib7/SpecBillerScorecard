/**
 * Shared numeric helpers. Every rounding in the app goes through these.
 */

/** Tolerance for comparing computed values against targets/thresholds (absorbs float drift). */
export const EPS = 1e-9;

/** Round to 1 decimal place. The ONLY rounding used for scores and metric values. */
export function round1(x: number): number {
  return Math.round(x * 10 + 1e-9) / 10;
}

/** Round money to the nearest $100. The ONLY rounding used for dollar estimates. */
export function roundMoney(x: number): number {
  return Math.round(x / 100 + 1e-9) * 100;
}

/** Division that never yields NaN or Infinity: returns null instead. */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : null;
}

/** a ≥ b, tolerant of float drift. */
export function gte(a: number, b: number): boolean {
  return a >= b - EPS;
}

/** a ≤ b, tolerant of float drift. */
export function lte(a: number, b: number): boolean {
  return a <= b + EPS;
}
