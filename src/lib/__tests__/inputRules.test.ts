import { describe, expect, it } from 'vitest';
import { validateInputs } from '../../engine';
import { EXAMPLE_FORM, toInputs, type FormState } from '../formState';
import { COUNT_FORMAT_MESSAGE, fieldMessage, formatNumberInput, MONEY_FORMAT_MESSAGE } from '../inputRules';
import type { NumericField } from '../../engine';

/** What the visitor would see for `field` after typing `typed`: the field text, whether Next is blocked, and the message. */
function enter(field: NumericField, typed: string) {
  const kind = ['claimsSubmitted3', 'claimsDenied3', 'claimsPaidFirstPass3'].includes(field) ? 'count' : 'money';
  const shown = formatNumberInput(typed, kind);
  const form: FormState = { ...EXAMPLE_FORM, values: { ...EXAMPLE_FORM.values, [field]: shown } };
  const err = validateInputs(toInputs(form)).errors.find((e) => e.field === field);
  return { shown, blocked: !!err, message: err ? fieldMessage(err.message, field, "I don't have this number") : null, value: toInputs(form)[field] };
}

describe('number inputs never silently change what the visitor typed', () => {
  it('"12.5" in a claim count: kept as typed, blocked, whole-number message', () => {
    expect(enter('claimsSubmitted3', '12.5')).toMatchObject({ shown: '12.5', blocked: true, message: COUNT_FORMAT_MESSAGE });
    expect(COUNT_FORMAT_MESSAGE).toBe('Please enter a whole number of claims.');
  });

  it('"12k5" in a claim count: kept as typed, blocked, whole-number message', () => {
    expect(enter('claimsDenied3', '12k5')).toMatchObject({ shown: '12k5', blocked: true, message: COUNT_FORMAT_MESSAGE });
  });

  it('"1,500" in a claim count is valid', () => {
    expect(enter('claimsSubmitted3', '1,500')).toMatchObject({ shown: '1,500', blocked: false, value: 1500 });
  });

  it('"$12,500.50" in a money field is valid and keeps its cents', () => {
    expect(enter('adjustments3', '$12,500.50')).toMatchObject({ shown: '12,500.50', blocked: false, value: 12500.5 });
  });

  it('"12..5" in a money field: kept as typed, blocked, "Numbers only, please."', () => {
    expect(enter('payments3', '12..5')).toMatchObject({ shown: '12..5', blocked: true, message: MONEY_FORMAT_MESSAGE });
    expect(MONEY_FORMAT_MESSAGE).toBe('Numbers only, please.');
  });

  it('pasted "$ 300,000" in a money field is valid', () => {
    expect(enter('charges3', '$ 300,000')).toMatchObject({ shown: '300,000', blocked: false, value: 300000 });
  });

  it('"$12,500", "12,500" and "12500" all give the same value', () => {
    expect(['$12,500', '12,500', '12500'].map((t) => enter('ar90', t).value)).toEqual([12500, 12500, 12500]);
  });

  it('letters or a minus sign in a money field: kept, blocked, "Numbers only, please."', () => {
    expect(enter('totalAR', '12k5')).toMatchObject({ shown: '12k5', blocked: true, message: MONEY_FORMAT_MESSAGE });
    expect(enter('totalAR', '-5000')).toMatchObject({ shown: '-5000', blocked: true, message: MONEY_FORMAT_MESSAGE });
  });

  it('long numbers are never truncated', () => {
    expect(formatNumberInput('1234567890123456', 'money')).toBe('1,234,567,890,123,456');
    expect(formatNumberInput('12.3456', 'money')).toBe('12.3456');
  });
});
