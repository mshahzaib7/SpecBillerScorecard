/**
 * Number input rules: never silently change what the visitor typed.
 *
 * - Claim counts: digits (commas and spaces allowed as separators). Anything else, including a
 *   decimal point or a letter, is kept exactly as typed so validation can flag it.
 * - Money: digits, commas, spaces, a leading $ and one decimal point. Anything else is kept exactly
 *   as typed so validation can flag it.
 * Valid input is tidied for reading (commas added, $ and spaces removed because the field shows its
 * own $ prefix). The number itself never changes: no truncation, no dropped characters.
 * Pasted text goes through the same function.
 */
import { INTEGER_FIELDS, MESSAGES, type NumericField } from '../engine';

export type NumberKind = 'money' | 'count';

const COUNT_OK = /^[\d,\s]*$/;
const MONEY_OK = /^\s*\$?[\d,\s]*(\.[\d\s]*)?$/;

const withCommas = (digits: string) => digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** True when the text follows the field's rules (empty text is "valid" here; required is checked elsewhere). */
export function isWellFormed(raw: string, kind: NumberKind): boolean {
  return kind === 'count' ? COUNT_OK.test(raw) : MONEY_OK.test(raw);
}

/** What the field shows after the visitor types or pastes `raw`. */
export function formatNumberInput(raw: string, kind: NumberKind): string {
  if (!isWellFormed(raw, kind)) return raw; // keep exactly what was typed; validation will say why
  if (kind === 'count') return withCommas(raw.replace(/[,\s]/g, ''));
  const cleaned = raw.replace(/[$,\s]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return withCommas(cleaned);
  const intPart = cleaned.slice(0, dot);
  return `${intPart === '' ? '0' : withCommas(intPart)}.${cleaned.slice(dot + 1)}`;
}

export const MONEY_FORMAT_MESSAGE = 'Numbers only, please.';
export const COUNT_FORMAT_MESSAGE = MESSAGES.notInteger; // "Please enter a whole number of claims."

/** Messages that come from how the number is written (shown at once, while typing). */
export const FORMAT_MESSAGES: readonly string[] = [MESSAGES.invalidNumber, MESSAGES.notInteger, MESSAGES.negative];

/**
 * The visitor-facing wording for an engine validation message on a number field.
 * Claim counts get one message for any non-whole number; money fields get "Numbers only, please."
 */
export function fieldMessage(message: string, field: NumericField, dontHaveLabel: string): string {
  if (message === MESSAGES.requiredOrUnknown) return `Enter a number, or tick “${dontHaveLabel}”.`;
  if (!FORMAT_MESSAGES.includes(message)) return message;
  return INTEGER_FIELDS.includes(field) ? COUNT_FORMAT_MESSAGE : MONEY_FORMAT_MESSAGE;
}
