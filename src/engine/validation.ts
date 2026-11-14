/**
 * Input validation (spec section 7). Errors block the scorecard; warnings are shown as notes.
 */
import { VALIDATION } from './config';
import { computeBase, computeMetricValues, toNumbers } from './formulas';
import type {
  InputField,
  IssueCode,
  NumericField,
  ScorecardInputs,
  ValidationIssue,
  ValidationResult,
} from './types';
import { UNKNOWN } from './types';

/** Fields that must have a number. */
export const REQUIRED_FIELDS: readonly NumericField[] = [
  'charges3',
  'adjustments3',
  'payments3',
  'claimsSubmitted3',
  'totalAR',
];

/** Fields where "I don't know" is allowed. */
export const UNKNOWN_ALLOWED_FIELDS: readonly NumericField[] = [
  'claimsDenied3',
  'claimsPaidFirstPass3',
  'ar90',
];

/** Fields that are counts of claims (whole numbers only). */
export const INTEGER_FIELDS: readonly NumericField[] = [
  'claimsSubmitted3',
  'claimsDenied3',
  'claimsPaidFirstPass3',
];

export const MESSAGES: Record<IssueCode, string> = {
  required: 'Please enter this number.',
  requiredOrUnknown: 'Please enter a number, or tick "I don\'t know".',
  invalidNumber: 'Please enter a valid number.',
  negative: "This can't be a negative number.",
  notInteger: 'Please enter a whole number of claims.',
  specialtyRequired: 'Please choose your type of practice.',
  attorneyRequired: 'Please answer yes or no.',
  adjustmentsTooHigh: 'Adjustments must be less than total charges. Please double-check both numbers.',
  ar90TooHigh: "AR over 90 days can't be more than your total AR.",
  deniedTooHigh: "Denied claims can't be more than the claims you submitted.",
  firstPassTooHigh: "First-pass paid claims can't be more than the claims you submitted.",
  deniedPlusFirstPassTooHigh:
    "Denied claims plus first-pass paid claims can't be more than the claims you submitted.",
  ncrTooHigh: 'Payments look too high for these charges. Please double-check the numbers.',
  ncrNotGraded:
    'Payments are higher than what was owed after adjustments, so net collection rate is not graded.',
  ncrAbove100:
    'Above 100% can happen when late payments from earlier months land in this period.',
  darVeryHigh: 'This is unusually high. Please double-check total AR and charges.',
  smallClaims: 'Small numbers can swing a lot. Results are less reliable.',
};

const NUMERIC_FIELDS: readonly NumericField[] = [
  'charges3',
  'adjustments3',
  'payments3',
  'claimsSubmitted3',
  'claimsDenied3',
  'claimsPaidFirstPass3',
  'totalAR',
  'ar90',
];

export function validateInputs(inputs: ScorecardInputs): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const hasError = (f: InputField) => errors.some((e) => e.field === f);
  const addError = (field: InputField, code: IssueCode) => {
    if (!hasError(field)) errors.push({ field, code, message: MESSAGES[code] });
  };
  const addWarning = (field: InputField, code: IssueCode) => warnings.push({ field, code, message: MESSAGES[code] });

  // Practice
  if (inputs.specialty === null) addError('specialty', 'specialtyRequired');
  if (inputs.specialty === 'accident' && inputs.arIncludesAttorneyCases === null) {
    addError('arIncludesAttorneyCases', 'attorneyRequired');
  }

  // Per-field checks: empty, unknown-not-allowed, not finite, negative, not integer
  for (const field of NUMERIC_FIELDS) {
    const v = inputs[field];
    const unknownAllowed = UNKNOWN_ALLOWED_FIELDS.includes(field);
    if (v === null) {
      addError(field, unknownAllowed ? 'requiredOrUnknown' : 'required');
    } else if (v === UNKNOWN) {
      if (!unknownAllowed) addError(field, 'required');
    } else if (!Number.isFinite(v)) {
      addError(field, 'invalidNumber');
    } else if (v < 0) {
      addError(field, 'negative');
    } else if (INTEGER_FIELDS.includes(field) && !Number.isInteger(v)) {
      addError(field, 'notInteger');
    }
  }

  // Cross-field checks — only between fields that passed their own checks
  const n = toNumbers(inputs);
  const ok = (f: NumericField) => n[f] !== null && !hasError(f);

  if (ok('charges3') && ok('adjustments3') && n.adjustments3! >= n.charges3!) {
    addError('adjustments3', 'adjustmentsTooHigh');
  }
  if (ok('ar90') && ok('totalAR') && n.ar90! > n.totalAR!) {
    addError('ar90', 'ar90TooHigh');
  }
  if (ok('claimsSubmitted3')) {
    const sub = n.claimsSubmitted3!;
    if (ok('claimsDenied3') && n.claimsDenied3! > sub) addError('claimsDenied3', 'deniedTooHigh');
    if (ok('claimsPaidFirstPass3') && n.claimsPaidFirstPass3! > sub) {
      addError('claimsPaidFirstPass3', 'firstPassTooHigh');
    }
    if (
      ok('claimsDenied3') &&
      ok('claimsPaidFirstPass3') &&
      n.claimsDenied3! + n.claimsPaidFirstPass3! > sub
    ) {
      addError('claimsPaidFirstPass3', 'deniedPlusFirstPassTooHigh');
    }
  }

  // Checks on computed metrics (using the one shared formula module)
  const baseOk = ok('charges3') && ok('adjustments3');
  const base = computeBase(n);
  const values = computeMetricValues(n, base);

  if (baseOk && ok('payments3') && values.ncr !== null) {
    if (values.ncr > VALIDATION.ncrMaxError) {
      addError('payments3', 'ncrTooHigh');
    } else if (values.ncr > VALIDATION.ncrNotGradedAbove) {
      // Shown, but not graded (see isNcrRuleApplied in compute.ts).
      addWarning('payments3', 'ncrNotGraded');
    } else if (values.ncr > VALIDATION.ncrWarnAbove) {
      addWarning('payments3', 'ncrAbove100');
    }
  }
  if (ok('charges3') && ok('totalAR') && values.dar !== null && values.dar > VALIDATION.darWarnAbove) {
    addWarning('totalAR', 'darVeryHigh');
  }
  if (ok('claimsSubmitted3') && n.claimsSubmitted3! < VALIDATION.smallClaimsBelow) {
    addWarning('claimsSubmitted3', 'smallClaims');
  }

  return { valid: errors.length === 0, errors, warnings };
}
