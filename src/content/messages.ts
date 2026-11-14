/**
 * Every error and note a visitor can see on the questions, in plain words, with their own numbers.
 *
 * Rules: each message sits directly under its field and says what's wrong, why it usually happens
 * and how to fix it, in 2 to 3 short sentences.
 * - tone 'error' (red, warning icon): blocks Next.
 * - tone 'note' (amber, info icon): never blocks; ends with "You can continue."
 * - `edit`: the message is about an earlier answer, so it carries an "Edit [field]" link that jumps
 *   back to that question.
 *
 * The rules themselves (which numbers trigger what) live in src/engine/validation.ts and the
 * thresholds in src/engine/config.ts. This file only words them.
 */
import {
  INTEGER_FIELDS,
  round1,
  type InputField,
  type IssueCode,
  type NumericField,
  type NumericInput,
  type ScorecardInputs,
  type ValidationIssue,
} from '../engine';
import { DONT_HAVE_LABEL } from './copy';

export type MessageTone = 'error' | 'note';

export interface ShownMessage {
  tone: MessageTone;
  text: string;
  /** "Edit [label]" link back to an earlier question. */
  edit: { field: NumericField; label: string } | null;
}

const usdCents = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const usdWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const n = (v: NumericInput): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** A dollar amount the visitor typed, as they'd recognize it: "$35,000", "$12,500.50". */
const money = (v: number) => `$${usdCents.format(v)}`;
/** A computed dollar amount, shown with "about": whole dollars. */
const about = (v: number) => `$${usdWhole.format(v)}`;
/** A percentage with at most one decimal: "160%", "104.5%". */
const pct = (v: number) => `${round1(v).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;

/** Net collection rate (%) from the visitor's inputs, the same formula as the engine. */
function ncrOf(i: ScorecardInputs): { owed: number; rate: number } {
  const owed = n(i.charges3) - n(i.adjustments3);
  return { owed, rate: owed > 0 ? (n(i.payments3) * 100) / owed : 0 };
}

/** Note 5 without the closing "You can continue." Also used on the statement row after the reveal. */
export function ncrNotGradedText(i: ScorecardInputs): string {
  const { owed } = ncrOf(i);
  return (
    `Your payments (${money(n(i.payments3))}) are higher than what was owed after adjustments (${about(owed)}). ` +
    'This happens when old claims from earlier months get paid in these 3 months. ' +
    "We've left this number out of your grade so it stays fair."
  );
}

const CONTINUE = 'You can continue.';

const error = (text: string, edit: ShownMessage['edit'] = null): ShownMessage => ({ tone: 'error', text, edit });
const note = (text: string): ShownMessage => ({ tone: 'note', text, edit: null });

/** The words for one validation issue. */
export function explainIssue(issue: { field: InputField; code: IssueCode; message: string }, i: ScorecardInputs): ShownMessage {
  const f = issue.field;
  switch (issue.code) {
    // 13. Required field empty
    case 'required':
      return error('Please enter this number to continue.');
    case 'requiredOrUnknown':
      return error(`Please enter this number to continue, or tick “${DONT_HAVE_LABEL}” below.`);

    // 1 and 2. Badly written numbers
    case 'invalidNumber':
    case 'negative':
    case 'notInteger':
      return INTEGER_FIELDS.includes(f as NumericField)
        ? error('Please enter a whole number of claims, like 1,500.')
        : error('Numbers only, please. You can type 12500, 12,500 or $12,500.');

    // 3. Adjustments equal to or more than charges
    case 'adjustmentsTooHigh':
      return error(
        `Adjustments (${money(n(i.adjustments3))}) can't be more than charges (${money(n(i.charges3))}). ` +
          'This usually happens when a yearly total or other write-offs get included. ' +
          'Use contractual adjustments for the same 3 months only.',
      );

    // 4. Payments over 150% of what was owed
    case 'ncrTooHigh': {
      const { owed, rate } = ncrOf(i);
      return error(
        `After ${money(n(i.adjustments3))} in contractual adjustments, you were owed about ${about(owed)}. ` +
          `Payments of ${money(n(i.payments3))} would mean collecting ${pct(rate)} of that, so one number is probably off. ` +
          'Check that adjustments are contractual only, with no bad debt or other write-offs.',
        { field: 'adjustments3', label: 'Edit adjustments' },
      );
    }

    // 5. Payments over 105% up to 150%: shown, not graded
    case 'ncrNotGraded':
      return note(`${ncrNotGradedText(i)} ${CONTINUE}`);

    // 6. Payments over 100% up to 105%
    case 'ncrAbove100':
      return note(
        `Payments are a little higher than what was owed (${pct(ncrOf(i).rate)}). ` +
          `That's normal when late payments from earlier months arrive in this period. ${CONTINUE}`,
      );

    // 7. Denied more than submitted
    case 'deniedTooHigh':
      return error(
        `Denied claims (${count.format(n(i.claimsDenied3))}) can't be more than claims submitted (${count.format(n(i.claimsSubmitted3))}). ` +
          'Check that both numbers cover the same 3 months.',
        { field: 'claimsSubmitted3', label: 'Edit claims submitted' },
      );

    // 8. Paid first try more than submitted
    case 'firstPassTooHigh':
      return error(
        `Claims paid on the first try (${count.format(n(i.claimsPaidFirstPass3))}) can't be more than claims submitted (${count.format(n(i.claimsSubmitted3))}). ` +
          'Check that both numbers cover the same 3 months.',
        { field: 'claimsSubmitted3', label: 'Edit claims submitted' },
      );

    // 9. Denied + paid first try more than submitted
    case 'deniedPlusFirstPassTooHigh': {
      const den = n(i.claimsDenied3);
      const fp = n(i.claimsPaidFirstPass3);
      return error(
        `Denied (${count.format(den)}) plus paid on the first try (${count.format(fp)}) adds up to ${count.format(den + fp)}, ` +
          `more than the ${count.format(n(i.claimsSubmitted3))} claims you sent. A claim can't be both. ` +
          'Check that each count covers the same 3 months.',
        { field: 'claimsDenied3', label: 'Edit denied claims' },
      );
    }

    // 10. AR over 90 days more than total AR
    case 'ar90TooHigh':
      return error(
        `This can't be more than your total AR (${money(n(i.totalAR))}), because it's part of that total. ` +
          'On your aging report, add only the 91 to 120 and 120+ columns.',
        { field: 'totalAR', label: 'Edit total AR' },
      );

    // 11. Days in AR over 365
    case 'darVeryHigh': {
      const days = n(i.charges3) > 0 ? Math.round((n(i.totalAR) * 90) / n(i.charges3)) : 0;
      return note(
        `Your total AR is more than a full year of charges (${count.format(days)} days). That's unusual. ` +
          `Check that total AR is today's total and charges cover only the last 3 months. ${CONTINUE}`,
      );
    }

    // 12. Fewer than 30 claims
    case 'smallClaims':
      return note('With fewer than 30 claims, a few claims can move the results a lot. You can continue, but treat the grade as a rough guide.');

    // Choice questions keep their short engine wording.
    case 'specialtyRequired':
    case 'attorneyRequired':
      return error(issue.message);
  }
}

/** Codes about how the number is written: shown at once, while typing. */
export const FORMAT_CODES: readonly IssueCode[] = ['invalidNumber', 'negative', 'notInteger'];
/** Codes for an empty answer: shown only after the visitor presses Next. */
export const EMPTY_CODES: readonly IssueCode[] = ['required', 'requiredOrUnknown', 'specialtyRequired', 'attorneyRequired'];

/** Convenience for tests and QA: every message on one field, errors first. */
export function messagesFor(field: InputField, issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] }, i: ScorecardInputs): ShownMessage[] {
  return [...issues.errors, ...issues.warnings].filter((x) => x.field === field).map((x) => explainIssue(x, i));
}
