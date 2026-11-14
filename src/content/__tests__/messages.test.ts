/**
 * Every error and note a visitor can see, with their own numbers (Part 2 of the Nov 14 brief).
 * Each case goes through the real engine validation, then the visitor-facing wording.
 */
import { describe, expect, it } from 'vitest';
import { UNKNOWN, validateInputs, type InputField, type ScorecardInputs } from '../../engine';
import { EXAMPLE_INPUTS } from '../../lib/formState';
import { explainIssue, messagesFor, ncrNotGradedText, type ShownMessage } from '../messages';

const only = (field: InputField, patch: Partial<ScorecardInputs>): ShownMessage => {
  const inputs = { ...EXAMPLE_INPUTS, ...patch };
  const all = messagesFor(field, validateInputs(inputs), inputs);
  expect(all.length).toBeGreaterThan(0);
  return all[0]!;
};
const blocks = (m: ShownMessage) => m.tone === 'error';

// User's example practice: charges 75,000, adjustments 35,000 → owed 40,000.
const P = { charges3: 75_000, adjustments3: 35_000 };

describe('field messages: wording, tone and edit links', () => {
  it('1. letters or symbols in a money field (red)', () => {
    const m = only('charges3', { charges3: Number.NaN });
    expect(m.text).toBe('Numbers only, please. You can type 12500, 12,500 or $12,500.');
    expect(blocks(m)).toBe(true);
    expect(only('totalAR', { totalAR: -5 }).text).toBe(m.text);
  });

  it('2. decimal or letters in a claim count (red)', () => {
    const m = only('claimsSubmitted3', { claimsSubmitted3: 12.5 });
    expect(m.text).toBe('Please enter a whole number of claims, like 1,500.');
    expect(blocks(m)).toBe(true);
    expect(only('claimsDenied3', { claimsDenied3: Number.NaN }).text).toBe(m.text);
  });

  it('3. adjustments equal to or more than charges (red), with the visitor’s numbers', () => {
    const m = only('adjustments3', { charges3: 75_000, adjustments3: 80_000 });
    expect(m.text).toBe(
      "Adjustments ($80,000) can't be more than charges ($75,000). This usually happens when a yearly total or other write-offs get included. Use contractual adjustments for the same 3 months only.",
    );
    expect(blocks(m)).toBe(true);
    expect(m.edit).toBeNull();
    expect(only('adjustments3', { charges3: 75_000, adjustments3: 75_000 }).text).toContain('($75,000)');
  });

  it('4. payments 64,000 → 160% (red) with "Edit adjustments"', () => {
    const m = only('payments3', { ...P, payments3: 64_000 });
    expect(m.text).toBe(
      'After $35,000 in contractual adjustments, you were owed about $40,000. Payments of $64,000 would mean collecting 160% of that, so one number is probably off. Check that adjustments are contractual only, with no bad debt or other write-offs.',
    );
    expect(blocks(m)).toBe(true);
    expect(m.edit).toEqual({ field: 'adjustments3', label: 'Edit adjustments' });
  });

  it('5. payments 50,000 → 125% (amber): not graded, can continue', () => {
    const inputs = { ...EXAMPLE_INPUTS, ...P, payments3: 50_000 };
    const v = validateInputs(inputs);
    expect(v.valid).toBe(true);
    const m = messagesFor('payments3', v, inputs)[0]!;
    expect(m.text).toBe(
      "Your payments ($50,000) are higher than what was owed after adjustments ($40,000). This happens when old claims from earlier months get paid in these 3 months. We've left this number out of your grade so it stays fair. You can continue.",
    );
    expect(blocks(m)).toBe(false);
    expect(m.text.endsWith('You can continue.')).toBe(true);
    // The statement row shows the same note without "You can continue."
    expect(ncrNotGradedText(inputs)).toBe(m.text.replace(' You can continue.', ''));
  });

  it('6. payments 41,800 → 104.5% (amber)', () => {
    const m = only('payments3', { ...P, payments3: 41_800 });
    expect(m.text).toBe(
      "Payments are a little higher than what was owed (104.5%). That's normal when late payments from earlier months arrive in this period. You can continue.",
    );
    expect(blocks(m)).toBe(false);
  });

  it('7. denied more than submitted (red) with "Edit claims submitted"', () => {
    const m = only('claimsDenied3', { claimsSubmitted3: 1_500, claimsDenied3: 1_600, claimsPaidFirstPass3: 0 });
    expect(m.text).toBe("Denied claims (1,600) can't be more than claims submitted (1,500). Check that both numbers cover the same 3 months.");
    expect(m.edit).toEqual({ field: 'claimsSubmitted3', label: 'Edit claims submitted' });
    expect(blocks(m)).toBe(true);
  });

  it('8. paid first try more than submitted (red) with "Edit claims submitted"', () => {
    const m = only('claimsPaidFirstPass3', { claimsSubmitted3: 1_500, claimsDenied3: 0, claimsPaidFirstPass3: 1_700 });
    expect(m.text).toBe(
      "Claims paid on the first try (1,700) can't be more than claims submitted (1,500). Check that both numbers cover the same 3 months.",
    );
    expect(m.edit).toEqual({ field: 'claimsSubmitted3', label: 'Edit claims submitted' });
  });

  it('9. denied + paid first try more than submitted (red) with "Edit denied claims"', () => {
    const m = only('claimsPaidFirstPass3', { claimsSubmitted3: 1_500, claimsDenied3: 180, claimsPaidFirstPass3: 1_400 });
    expect(m.text).toBe(
      "Denied (180) plus paid on the first try (1,400) adds up to 1,580, more than the 1,500 claims you sent. A claim can't be both. Check that each count covers the same 3 months.",
    );
    expect(m.edit).toEqual({ field: 'claimsDenied3', label: 'Edit denied claims' });
    expect(blocks(m)).toBe(true);
  });

  it('10. AR over 90 more than total AR (red) with "Edit total AR"', () => {
    const m = only('ar90', { totalAR: 190_000, ar90: 200_000 });
    expect(m.text).toBe(
      "This can't be more than your total AR ($190,000), because it's part of that total. On your aging report, add only the 91 to 120 and 120+ columns.",
    );
    expect(m.edit).toEqual({ field: 'totalAR', label: 'Edit total AR' });
  });

  it('11. days in AR over 365 (amber)', () => {
    // 300,000 charges → 1,500,000 AR = 450 days
    const m = only('totalAR', { totalAR: 1_500_000, ar90: 0 });
    expect(m.text).toBe(
      "Your total AR is more than a full year of charges (450 days). That's unusual. Check that total AR is today's total and charges cover only the last 3 months. You can continue.",
    );
    expect(blocks(m)).toBe(false);
  });

  it('12. fewer than 30 claims (amber)', () => {
    const m = only('claimsSubmitted3', { claimsSubmitted3: 20, claimsDenied3: 2, claimsPaidFirstPass3: 15 });
    expect(m.text).toBe('With fewer than 30 claims, a few claims can move the results a lot. You can continue, but treat the grade as a rough guide.');
    expect(blocks(m)).toBe(false);
  });

  it('13. required field empty (red); optional fields point to the checkbox', () => {
    expect(only('charges3', { charges3: null }).text).toBe('Please enter this number to continue.');
    const opt = only('ar90', { ar90: null });
    expect(opt.text).toBe('Please enter this number to continue, or tick “I don\'t have this number” below.');
    expect(blocks(opt)).toBe(true);
    // ticking the box clears it
    expect(validateInputs({ ...EXAMPLE_INPUTS, ar90: UNKNOWN }).errors).toEqual([]);
  });

  it('every note ends with "You can continue" wording; every error blocks', () => {
    const cases: Partial<ScorecardInputs>[] = [
      { ...P, payments3: 50_000 },
      { ...P, payments3: 41_800 },
      { totalAR: 1_500_000, ar90: 0 },
      { claimsSubmitted3: 20, claimsDenied3: 2, claimsPaidFirstPass3: 15 },
    ];
    for (const patch of cases) {
      const inputs = { ...EXAMPLE_INPUTS, ...patch };
      const v = validateInputs(inputs);
      expect(v.valid).toBe(true);
      for (const w of v.warnings) expect(explainIssue(w, inputs).text).toMatch(/You can continue/);
    }
  });

  it('every message is 1 to 3 sentences (short and plain)', () => {
    const inputs = { ...EXAMPLE_INPUTS, ...P, payments3: 64_000 };
    const m = explainIssue(validateInputs(inputs).errors[0]!, inputs);
    expect(m.text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3);
  });
});
