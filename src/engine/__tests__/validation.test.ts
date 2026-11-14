import { describe, expect, it } from 'vitest';
import type { NumericField, ScorecardInputs } from '../types';
import { UNKNOWN } from '../types';
import { MESSAGES, validateInputs } from '../validation';
import { STRUGGLING_INPUTS } from './golden.fixtures';

const v = (patch: Partial<ScorecardInputs>) => validateInputs({ ...STRUGGLING_INPUTS, ...patch });
const errorFor = (patch: Partial<ScorecardInputs>, field: string) =>
  v(patch).errors.find((e) => e.field === field)?.message;
const warningFor = (patch: Partial<ScorecardInputs>, field: string) =>
  v(patch).warnings.find((e) => e.field === field)?.message;

describe('validation — valid input', () => {
  it('golden 1 has no errors and no warnings', () => {
    const r = v({});
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('"I don\'t know" is accepted on every optional field', () => {
    const r = v({ claimsDenied3: UNKNOWN, claimsPaidFirstPass3: UNKNOWN, ar90: UNKNOWN });
    expect(r.errors).toEqual([]);
  });
});

describe('validation — errors', () => {
  const required: NumericField[] = ['charges3', 'adjustments3', 'payments3', 'claimsSubmitted3', 'totalAR'];

  it.each(required)('required field %s empty → error', (field) => {
    expect(errorFor({ [field]: null }, field)).toBe(MESSAGES.required);
  });

  it.each(required)('required field %s cannot be "I don\'t know"', (field) => {
    expect(errorFor({ [field]: UNKNOWN }, field)).toBe(MESSAGES.required);
  });

  it.each(['claimsDenied3', 'claimsPaidFirstPass3', 'ar90'] as const)(
    'optional field %s empty (neither number nor "I don\'t know") → error',
    (field) => {
      expect(errorFor({ [field]: null }, field)).toBe(MESSAGES.requiredOrUnknown);
    },
  );

  it.each([
    'charges3',
    'adjustments3',
    'payments3',
    'claimsSubmitted3',
    'claimsDenied3',
    'claimsPaidFirstPass3',
    'totalAR',
    'ar90',
  ] as const)('negative %s → error', (field) => {
    expect(errorFor({ [field]: -1 }, field)).toBe(MESSAGES.negative);
  });

  it('NaN / Infinity → error', () => {
    expect(errorFor({ charges3: Number.NaN }, 'charges3')).toBe(MESSAGES.invalidNumber);
    expect(errorFor({ totalAR: Number.POSITIVE_INFINITY }, 'totalAR')).toBe(MESSAGES.invalidNumber);
  });

  it.each(['claimsSubmitted3', 'claimsDenied3', 'claimsPaidFirstPass3'] as const)(
    'non-integer claim count %s → error',
    (field) => {
      expect(errorFor({ [field]: 10.5 }, field)).toBe(MESSAGES.notInteger);
    },
  );

  it('specialty missing → error', () => {
    expect(errorFor({ specialty: null }, 'specialty')).toBe(MESSAGES.specialtyRequired);
  });

  it('Accident / PI without the attorney-case answer → error', () => {
    expect(errorFor({ specialty: 'accident', arIncludesAttorneyCases: null }, 'arIncludesAttorneyCases')).toBe(
      MESSAGES.attorneyRequired,
    );
    expect(v({ specialty: 'accident', arIncludesAttorneyCases: false }).valid).toBe(true);
  });

  it('adjustments3 >= charges3 → error (equal and greater)', () => {
    expect(errorFor({ adjustments3: 300_000 }, 'adjustments3')).toBe(MESSAGES.adjustmentsTooHigh);
    expect(errorFor({ adjustments3: 300_001 }, 'adjustments3')).toBe(MESSAGES.adjustmentsTooHigh);
    expect(errorFor({ adjustments3: 299_999, payments3: 1 }, 'adjustments3')).toBeUndefined();
  });

  it('ar90 > totalAR → error; equal is allowed', () => {
    expect(errorFor({ ar90: 190_001 }, 'ar90')).toBe(MESSAGES.ar90TooHigh);
    expect(errorFor({ ar90: 190_000 }, 'ar90')).toBeUndefined();
  });

  it('claimsDenied3 > claimsSubmitted3 → error', () => {
    expect(errorFor({ claimsDenied3: 1_501, claimsPaidFirstPass3: 0 }, 'claimsDenied3')).toBe(MESSAGES.deniedTooHigh);
  });

  it('claimsPaidFirstPass3 > claimsSubmitted3 → error', () => {
    expect(errorFor({ claimsPaidFirstPass3: 1_501, claimsDenied3: 0 }, 'claimsPaidFirstPass3')).toBe(
      MESSAGES.firstPassTooHigh,
    );
  });

  it('claimsDenied3 + claimsPaidFirstPass3 > claimsSubmitted3 → error; equal is allowed', () => {
    expect(errorFor({ claimsDenied3: 241, claimsPaidFirstPass3: 1_260 }, 'claimsPaidFirstPass3')).toBe(
      MESSAGES.deniedPlusFirstPassTooHigh,
    );
    expect(v({ claimsDenied3: 240, claimsPaidFirstPass3: 1_260 }).valid).toBe(true);
  });

  it('NCR > 150% → error; exactly 150% is allowed', () => {
    // netCharges 180,000 → 150% = 270,000
    expect(errorFor({ payments3: 270_001 }, 'payments3')).toBe(MESSAGES.ncrTooHigh);
    expect(errorFor({ payments3: 270_000 }, 'payments3')).toBeUndefined();
    expect(errorFor({ payments3: 189_001 }, 'payments3')).toBeUndefined();
  });

  it('each issue carries a code that matches its message', () => {
    const r = v({ payments3: 270_001, ar90: 190_001 });
    for (const e of [...r.errors, ...r.warnings]) expect(e.message).toBe(MESSAGES[e.code]);
    expect(r.errors.map((e) => e.code).sort()).toEqual(['ar90TooHigh', 'ncrTooHigh']);
  });
});

describe('validation — warnings (allowed)', () => {
  it('105% < NCR ≤ 150% → "not graded" note, still valid', () => {
    const r = v({ payments3: 189_001 });
    expect(r.valid).toBe(true);
    expect(warningFor({ payments3: 189_001 }, 'payments3')).toBe(MESSAGES.ncrNotGraded);
    expect(warningFor({ payments3: 270_000 }, 'payments3')).toBe(MESSAGES.ncrNotGraded);
    // only one note on the field
    expect(r.warnings.filter((w) => w.field === 'payments3')).toHaveLength(1);
  });

  it('100% < NCR ≤ 105% → warning, still valid', () => {
    const r = v({ payments3: 189_000 });
    expect(r.valid).toBe(true);
    expect(warningFor({ payments3: 189_000 }, 'payments3')).toBe(MESSAGES.ncrAbove100);
    expect(warningFor({ payments3: 180_001 }, 'payments3')).toBe(MESSAGES.ncrAbove100);
  });

  it('NCR exactly 100% → no warning', () => {
    expect(warningFor({ payments3: 180_000 }, 'payments3')).toBeUndefined();
  });

  it('DAR > 365 → warning, still valid', () => {
    // DAR = totalAR × 90 / 300,000 → 365 days = 1,216,666.67
    const patch = { totalAR: 1_220_000, ar90: 0 };
    expect(v(patch).valid).toBe(true);
    expect(warningFor(patch, 'totalAR')).toBe(MESSAGES.darVeryHigh);
    expect(warningFor({ totalAR: 1_216_000 }, 'totalAR')).toBeUndefined();
  });

  it('claimsSubmitted3 < 30 → warning, still valid; 30 → none', () => {
    const patch = { claimsSubmitted3: 29, claimsDenied3: 2, claimsPaidFirstPass3: 25 };
    expect(v(patch).valid).toBe(true);
    expect(warningFor(patch, 'claimsSubmitted3')).toBe(MESSAGES.smallClaims);
    expect(warningFor({ ...patch, claimsSubmitted3: 30 }, 'claimsSubmitted3')).toBeUndefined();
  });
});
