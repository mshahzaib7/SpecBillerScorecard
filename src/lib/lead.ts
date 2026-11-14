/**
 * Lead capture (spec 12.4): pure helpers for the one-question-at-a-time lead flow, plus one send
 * function. Nothing leaves the browser until the visitor presses "Send my report" (the flow only
 * calls sendLead() from that button's submit handler). Scorecard numbers are included ONLY when
 * the visitor picked "Yes, attach my scorecard".
 *
 * All visitor-facing words come from LEAD_FLOW in src/engine/config.ts.
 */
import {
  isPlaceholder,
  LEAD_FLOW,
  LEAD_PRIORITY_RULE,
  leadPriority,
  METRIC_ORDER,
  METRICS,
  offerCopy,
  PAIN_POINTS,
  SPECIALTIES,
  type BillingHandlerId,
  type ContactMethod,
  type LeadPriority,
  type LeadTile,
  type NumericField,
  type OfferId,
  type PainPointId,
  type ProvidersId,
  type ReviewId,
  type ScorecardInputs,
  type ScorecardResult,
  type SoftwareId,
  type Specialty,
  type TimingId,
} from '../engine';

export interface LeadAnswers {
  billingHandler: BillingHandlerId | null;
  providers: ProvidersId | null;
  software: SoftwareId | null;
  /** Typed name when software = "Something else". */
  softwareOther: string;
  timing: TimingId | null;
  review: ReviewId | null;
  methods: ContactMethod[];
  name: string;
  practiceName: string;
  email: string;
  phone: string;
  /** Honeypot: hidden from people. Anything typed here means a bot. */
  website: string;
}

export const EMPTY_ANSWERS: LeadAnswers = {
  billingHandler: null,
  providers: null,
  software: null,
  softwareOther: '',
  timing: null,
  review: null,
  methods: [...LEAD_FLOW.contact.defaultSelected],
  name: '',
  practiceName: '',
  email: '',
  phone: '',
  website: '',
};

/** What the scorecard already knows; the flow never asks for these again. */
export interface LeadContext {
  specialty: Specialty | null;
  grade: string | null;
  offer: OfferId | null;
  painPoints: readonly PainPointId[];
}

/* ------------------------------ Screens ------------------------------ */

export type ScreenId = 'billingHandler' | 'providers' | 'software' | 'timing' | 'review' | 'contact' | 'details';

/** The screens that are switched on, in order. The details screen is always shown. */
export function enabledScreens(cfg: Record<Exclude<ScreenId, 'details'>, { on: boolean }> = LEAD_FLOW): ScreenId[] {
  const optional: Exclude<ScreenId, 'details'>[] = ['billingHandler', 'providers', 'software', 'timing', 'review', 'contact'];
  return [...optional.filter((id) => cfg[id].on), 'details'];
}

const onTiles = <Id extends string>(tiles: readonly LeadTile<Id>[]) => tiles.filter((t) => t.on);

/** Software tiles, with the ones a specialty uses most moved to the front. */
export function softwareTiles(specialty: Specialty | null): LeadTile<SoftwareId>[] {
  const tiles = onTiles(LEAD_FLOW.software.tiles);
  const order = LEAD_FLOW.software.orderBySpecialty;
  const first: readonly SoftwareId[] = !order.on ? [] : specialty === 'behavioral' ? order.behavioral : specialty === 'general' ? order.general : [];
  const front = first.map((id) => tiles.find((t) => t.id === id)).filter((t): t is LeadTile<SoftwareId> => !!t);
  return [...front, ...tiles.filter((t) => !first.includes(t.id))];
}

/* ------------------------------ Contact methods ------------------------------ */

const METHOD_ORDER: readonly ContactMethod[] = ['call', 'text', 'email'];

/** Multi-select toggle that never leaves zero methods selected. */
export function toggleMethod(methods: readonly ContactMethod[], m: ContactMethod): ContactMethod[] {
  if (methods.includes(m)) return methods.length === 1 ? [...methods] : methods.filter((x) => x !== m);
  return METHOD_ORDER.filter((x) => x === m || methods.includes(x));
}

export const needsPhone = (methods: readonly ContactMethod[]): boolean => methods.includes('call') || methods.includes('text');

/** ["call", "text", "email"] → "call, text or email". */
export function joinNatural(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

const sorted = (methods: readonly ContactMethod[]) => METHOD_ORDER.filter((m) => methods.includes(m));
const promise = () => (LEAD_FLOW.promise.on ? ` ${LEAD_FLOW.promise.text}` : '');

/** Under the details fields: "We'll reach you by call or email within one business day." */
export function reachLine(methods: readonly ContactMethod[]): string {
  return `We'll reach you by ${joinNatural(sorted(methods))}${promise()}.`;
}

/** Success screen: "We'll call or email you within one business day." */
export function successReachLine(methods: readonly ContactMethod[]): string {
  return `We'll ${joinNatural(sorted(methods))} you${promise()}.`;
}

/* ------------------------------ Details: validation and phone ------------------------------ */

export type DetailsField = 'name' | 'practiceName' | 'email' | 'phone';
export type DetailsErrors = Partial<Record<DetailsField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** US phone digits (a leading country code 1 is dropped), at most 10. */
export function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
}

/** Formats as the visitor types: "5" → "(5", "555555" → "(555) 555", "5555550142" → "(555) 555-0142". */
export function formatUsPhone(raw: string): string {
  const d = phoneDigits(raw);
  if (d.length > 10) return raw; // keep exactly what was typed; validation will say why
  if (d.length === 0) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Email is always required (the report goes there). Phone only when Call or Text is picked. */
export function validateDetails(a: LeadAnswers): DetailsErrors {
  const E = LEAD_FLOW.details.errors;
  const e: DetailsErrors = {};
  if (!a.name.trim()) e.name = E.name;
  if (!a.practiceName.trim()) e.practiceName = E.practiceName;
  if (!a.email.trim()) e.email = E.email;
  else if (!EMAIL_RE.test(a.email.trim())) e.email = E.emailInvalid;
  if (needsPhone(a.methods)) {
    if (!a.phone.trim()) e.phone = E.phone;
    else if (phoneDigits(a.phone).length !== 10) e.phone = E.phoneInvalid;
  }
  return e;
}

export const isSpam = (a: LeadAnswers): boolean => a.website.trim() !== '';

/* ------------------------------ Lead email ------------------------------ */

/** "[HIGH] New lead: Harbor Behavioral Health, grade F, wants a call or text, as soon as possible" */
export function leadSubject(practiceName: string, grade: string | null, methods: readonly ContactMethod[], timing: TimingId | null): string {
  const tag = LEAD_PRIORITY_RULE.on ? `[${leadPriority(timing, grade)}] ` : '';
  const ways = joinNatural(sorted(methods));
  const article = /^[aeiou]/.test(ways) ? 'an' : 'a';
  const parts = [`New lead: ${practiceName}`, `grade ${grade ?? 'not available'}`, `wants ${article} ${ways}`];
  if (timing) parts.push(LEAD_FLOW.timing.subject[timing]);
  return tag + parts.join(', ');
}

const labelOf = <Id extends string>(tiles: readonly LeadTile<Id>[], id: Id | null): string | null => (id === null ? null : tiles.find((t) => t.id === id)?.label ?? id);
const METHOD_WORD: Record<ContactMethod, string> = { call: 'Call', text: 'Text', email: 'Email' };
const MONEY_INPUTS: readonly NumericField[] = ['charges3', 'adjustments3', 'payments3', 'totalAR', 'ar90'];
const INPUT_LABEL: Record<NumericField, string> = {
  charges3: 'Charges (3 months)',
  adjustments3: 'Contractual adjustments (3 months)',
  payments3: 'Payments (3 months)',
  claimsSubmitted3: 'Claims submitted (3 months)',
  claimsDenied3: 'Claims denied (3 months)',
  claimsPaidFirstPass3: 'Claims paid on the first try (3 months)',
  totalAR: 'Total AR today',
  ar90: 'AR over 90 days',
};

/**
 * Formspree fields. Every key becomes one line in the lead email. The visitor's address goes in
 * the field named "email", so Formspree uses it as the reply-to.
 */
export interface LeadPayload {
  _subject: string;
  priority: LeadPriority | null;
  name: string;
  practiceName: string;
  email: string;
  phone: string;
  preferredContact: string;
  billingHandledBy: string | null;
  providers: string | null;
  practiceSoftware: string | null;
  wantsHelp: string | null;
  reviewNumbersFirst: string | null;
  specialty: string | null;
  painPoints: string;
  grade: string;
  overallScore: number | null;
  offer: string | null;
  /** Present ONLY when the visitor picked "Yes, attach my scorecard". */
  scorecardNumbers?: string;
}

/** The visitor's entered numbers and their scorecard, as readable lines. */
export function scorecardNumbersText(result: ScorecardResult, inputs: ScorecardInputs): string {
  const usd = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const lines: string[] = ['Numbers entered:'];
  for (const f of Object.keys(INPUT_LABEL) as NumericField[]) {
    const v = inputs[f];
    const shown = typeof v === 'number' ? (MONEY_INPUTS.includes(f) ? `$${usd.format(v)}` : usd.format(v)) : 'not reported';
    lines.push(`  ${INPUT_LABEL[f]}: ${shown}`);
  }
  lines.push('Scorecard:');
  for (const id of METRIC_ORDER) {
    const m = result.metrics[id];
    const unit = METRICS[id].unit === '%' ? '%' : ' days';
    const value = m.displayValue === null ? 'not reported' : `${m.displayValue}${unit}`;
    const status = m.availability === 'notGraded' ? ' (not graded)' : m.status ? ` (${m.status})` : '';
    lines.push(`  ${METRICS[id].shortName}: ${value}${status}`);
  }
  for (const c of result.moneyCards) {
    lines.push(`  Money (${c.id}): vs. top $${usd.format(c.vsTop.rounded)}${c.vsGood ? `, vs. good $${usd.format(c.vsGood.rounded)}` : ''}${c.headline ? `, stuck now $${usd.format(c.headline.rounded)}` : ''}`);
  }
  return lines.join('\n');
}

export function buildLeadPayload(a: LeadAnswers, ctx: LeadContext, result: ScorecardResult, inputs: ScorecardInputs): LeadPayload {
  const F = LEAD_FLOW;
  const practiceName = a.practiceName.trim();
  const software =
    a.software === 'other' && a.softwareOther.trim()
      ? `${labelOf(F.software.tiles, 'other')}: ${a.softwareOther.trim()}`
      : labelOf(F.software.tiles, a.software);
  const payload: LeadPayload = {
    _subject: leadSubject(practiceName, ctx.grade, a.methods, a.timing),
    priority: LEAD_PRIORITY_RULE.on ? leadPriority(a.timing, ctx.grade) : null,
    name: a.name.trim(),
    practiceName,
    email: a.email.trim(),
    phone: needsPhone(a.methods) ? a.phone.trim() : '',
    preferredContact: sorted(a.methods).map((m) => METHOD_WORD[m]).join(', '),
    billingHandledBy: labelOf(F.billingHandler.tiles, a.billingHandler),
    providers: labelOf(F.providers.tiles, a.providers),
    practiceSoftware: software,
    wantsHelp: labelOf(F.timing.tiles, a.timing),
    reviewNumbersFirst: labelOf(F.review.tiles, a.review),
    specialty: ctx.specialty ? SPECIALTIES.find((s) => s.id === ctx.specialty)?.label ?? ctx.specialty : null,
    painPoints: ctx.painPoints.length ? PAIN_POINTS.filter((p) => ctx.painPoints.includes(p.id)).map((p) => p.label).join('; ') : 'None picked',
    grade: ctx.grade ?? 'Not enough data for a grade',
    overallScore: result.overall.score,
    offer: ctx.offer ? `${offerCopy(ctx.offer).headline} (${ctx.offer})` : null,
  };
  if (a.review === 'yes') payload.scorecardNumbers = scorecardNumbersText(result, inputs);
  return payload;
}

/** Plain-text version for the email fallback. */
export function leadEmailBody(p: LeadPayload): string {
  return Object.entries(p)
    .filter(([k, v]) => k !== '_subject' && v !== null && v !== '')
    .map(([k, v]) => (k === 'scorecardNumbers' ? `\n${v}` : `${k}: ${v}`))
    .join('\n');
}

export function mailtoHref(to: string, p: LeadPayload): string {
  return `mailto:${to}?subject=${encodeURIComponent(p._subject)}&body=${encodeURIComponent(leadEmailBody(p))}`;
}

export type SendOutcome =
  | { kind: 'sent' }
  | { kind: 'spam' }
  | { kind: 'mailto'; href: string }
  | { kind: 'error'; mailto: string | null };

export interface SendDeps {
  endpoint: string;
  contactEmail: string;
  fetchFn?: typeof fetch;
}

/**
 * Called ONLY from the "Send my report" submit handler.
 * - honeypot filled → rejected, nothing sent
 * - endpoint still a placeholder → returns a pre-filled email link instead
 * - POST fails → error, with the email link as a fallback (if an email is set)
 */
export async function sendLead(a: LeadAnswers, payload: LeadPayload, deps: SendDeps): Promise<SendOutcome> {
  if (isSpam(a)) return { kind: 'spam' };
  const mailto = isPlaceholder(deps.contactEmail) ? null : mailtoHref(deps.contactEmail, payload);
  if (isPlaceholder(deps.endpoint)) {
    return mailto ? { kind: 'mailto', href: mailto } : { kind: 'error', mailto: null };
  }
  try {
    const res = await (deps.fetchFn ?? fetch)(deps.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok ? { kind: 'sent' } : { kind: 'error', mailto };
  } catch {
    return { kind: 'error', mailto };
  }
}
