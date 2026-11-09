/**
 * Lead capture (spec 12.4). Pure helpers + one send function.
 * Nothing leaves the browser until the user presses Submit (the UI only calls
 * sendLead() from the form's submit handler). Scorecard numbers are included
 * ONLY when the user ticks the checkbox.
 */
import {
  isPlaceholder,
  METRIC_ORDER,
  METRICS,
  type MetricId,
  type MoneyCardId,
  type OfferId,
  type PainPointId,
  type ScorecardResult,
  type Specialty,
} from '../engine';

export interface LeadFields {
  name: string;
  practiceName: string;
  email: string;
  phone: string;
  includeNumbers: boolean;
  /** Honeypot: hidden from people. Anything typed here means a bot. */
  website: string;
}

export const EMPTY_LEAD: LeadFields = {
  name: '',
  practiceName: '',
  email: '',
  phone: '',
  includeNumbers: false,
  website: '',
};

export interface LeadContext {
  specialty: Specialty | null;
  grade: string | null;
  offer: OfferId | null;
  painPoints: readonly PainPointId[];
}

export interface LeadPayload {
  /** Formspree subject line: "New scorecard lead: [practice name], grade [grade]". */
  _subject: string;
  name: string;
  practiceName: string;
  email: string;
  phone: string;
  specialty: Specialty | null;
  grade: string | null;
  offer: OfferId | null;
  painPoints: PainPointId[];
  includeNumbers: boolean;
  /** Present only when includeNumbers is true. */
  scorecard?: {
    overallScore: number | null;
    metrics: Record<MetricId, number | null>;
    moneyCards: { id: MoneyCardId; vsGood: number | null; vsTop: number; headline: number | null }[];
  };
}

export type LeadField = 'name' | 'practiceName' | 'email' | 'phone';
export type LeadErrors = Partial<Record<LeadField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(f: LeadFields): LeadErrors {
  const e: LeadErrors = {};
  if (!f.name.trim()) e.name = 'Please enter your name.';
  if (!f.practiceName.trim()) e.practiceName = 'Please enter your practice name.';
  if (!f.email.trim()) e.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Please enter a valid email, like name@practice.com.';
  if (f.phone.trim()) {
    const digits = f.phone.replace(/\D/g, '');
    const us = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (us.length !== 10) e.phone = 'Please enter a 10-digit US phone number, or leave it empty.';
  }
  return e;
}

export const isSpam = (f: LeadFields): boolean => f.website.trim() !== '';

/** Subject for the notification email. The visitor's address goes in the field named "email", so a reply reaches them. */
export function leadSubject(practiceName: string, grade: string | null): string {
  return `New scorecard lead: ${practiceName}, grade ${grade ?? 'not available'}`;
}

export function buildLeadPayload(f: LeadFields, ctx: LeadContext, result: ScorecardResult): LeadPayload {
  const payload: LeadPayload = {
    _subject: leadSubject(f.practiceName.trim(), ctx.grade),
    name: f.name.trim(),
    practiceName: f.practiceName.trim(),
    email: f.email.trim(),
    phone: f.phone.trim(),
    specialty: ctx.specialty,
    grade: ctx.grade,
    offer: ctx.offer,
    painPoints: [...ctx.painPoints],
    includeNumbers: f.includeNumbers,
  };
  if (f.includeNumbers) {
    const metrics = {} as Record<MetricId, number | null>;
    for (const id of METRIC_ORDER) metrics[id] = result.metrics[id].displayValue;
    payload.scorecard = {
      overallScore: result.overall.score,
      metrics,
      moneyCards: result.moneyCards.map((c) => ({
        id: c.id,
        vsGood: c.vsGood?.rounded ?? null,
        vsTop: c.vsTop.rounded,
        headline: c.headline?.rounded ?? null,
      })),
    };
  }
  return payload;
}

/** Plain-text version for the email fallback. */
export function leadEmailBody(p: LeadPayload): string {
  const lines: (string | null)[] = [
    `Name: ${p.name}`,
    `Practice: ${p.practiceName}`,
    `Email: ${p.email}`,
    p.phone ? `Phone: ${p.phone}` : null,
    p.specialty ? `Specialty: ${p.specialty}` : null,
    `Grade: ${p.grade ?? 'not enough data'}`,
    p.offer ? `Offer: ${p.offer}` : null,
    p.painPoints.length ? `Pain points: ${p.painPoints.join(', ')}` : null,
  ];
  if (p.scorecard) {
    lines.push('', `Overall score: ${p.scorecard.overallScore ?? 'n/a'}`);
    for (const id of METRIC_ORDER) {
      const v = p.scorecard.metrics[id];
      const unit = METRICS[id].unit === '%' ? '%' : ' days';
      lines.push(`${METRICS[id].shortName}: ${v === null ? 'not reported' : `${v}${unit}`}`);
    }
    for (const c of p.scorecard.moneyCards) {
      lines.push(`Money (${c.id}): vs. Top $${c.vsTop}${c.vsGood !== null ? `, vs. Good $${c.vsGood}` : ''}`);
    }
  }
  return lines.filter((l): l is string => l !== null).join('\n');
}

export function mailtoHref(to: string, p: LeadPayload): string {
  const subject = `Scorecard report request: ${p.practiceName}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(leadEmailBody(p))}`;
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
 * Called ONLY from the form's submit handler.
 * - honeypot filled → rejected, nothing sent
 * - endpoint still a placeholder → returns a pre-filled email link instead
 * - POST fails → error, with the email link as a fallback (if an email is set)
 */
export async function sendLead(f: LeadFields, payload: LeadPayload, deps: SendDeps): Promise<SendOutcome> {
  if (isSpam(f)) return { kind: 'spam' };
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
