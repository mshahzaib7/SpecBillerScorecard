import { useEffect, useId, useRef, useState } from 'react';
import { isPlaceholder, LEAD_CONFIG, SITE, type ScorecardResult } from '../engine';
import { LEAD_COPY } from '../content/sections';
import {
  buildLeadPayload,
  EMPTY_LEAD,
  sendLead,
  validateLead,
  type LeadContext,
  type LeadErrors,
  type LeadField,
  type LeadFields,
  type SendOutcome,
} from '../lib/lead';
import { IconAlert, IconCheck } from './Icons';

interface Props {
  result: ScorecardResult;
  context: LeadContext;
}

/** Three required fields (DESIGN-BRIEF 9.7). Labels above inputs; placeholders are hints, not fake data. */
const FIELDS: { key: LeadField; label: string; type: string; autoComplete: string; required: boolean; inputMode?: 'email' | 'tel' }[] = [
  { key: 'name', label: 'Name', type: 'text', autoComplete: 'name', required: true },
  { key: 'practiceName', label: 'Practice name', type: 'text', autoComplete: 'organization', required: true },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true, inputMode: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', required: false, inputMode: 'tel' },
];

/**
 * Lead capture (DESIGN-BRIEF 7.10). Sends nothing until Submit; numbers only if the box is ticked.
 * After a successful submit the booking calendar loads inline, and only then: no third-party
 * script or frame is requested before the visitor sends the form.
 */
export function LeadForm({ result, context }: Props) {
  const id = useId();
  const [fields, setFields] = useState<LeadFields>(EMPTY_LEAD);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof LeadFields>(k: K, v: LeadFields[K]) => {
    setFields((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validateLead(fields);
    setErrors(errs);
    const first = FIELDS.find((f) => errs[f.key]);
    if (first) {
      document.getElementById(`${id}-${first.key}`)?.focus();
      return;
    }
    setSending(true);
    const payload = buildLeadPayload(fields, context, result);
    const out = await sendLead(fields, payload, { endpoint: LEAD_CONFIG.formEndpoint, contactEmail: SITE.contactEmail });
    setSending(false);
    setOutcome(out);
    if (out.kind === 'mailto') window.location.href = out.href;
  };

  const done = outcome?.kind === 'sent' || outcome?.kind === 'spam';
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const firstName = fields.name.trim().split(/\s+/)[0] ?? '';
  const booking = isPlaceholder(SITE.bookingLink) ? null : SITE.bookingLink;
  // Calendly renders as an inline widget when told so; other booking tools get the plain link.
  const bookingSrc =
    booking && /(^|\.)calendly\.com$/.test(new URL(booking).hostname)
      ? `${booking}${booking.includes('?') ? '&' : '?'}embed_type=Inline&embed_domain=${encodeURIComponent(window.location.hostname)}&hide_gdpr_banner=1`
      : booking;

  if (done) {
    return (
      <div className="leadf leadf--done" id="lead" ref={doneRef} tabIndex={-1} role="status">
        <span className="lead__doneicon" aria-hidden="true">
          <IconCheck size={22} />
        </span>
        <p className="lead__donetitle">{LEAD_COPY.successTitle(firstName)}</p>
        {booking && (
          <>
            <p className="lead__doneintro">{LEAD_COPY.bookingIntro}</p>
            <iframe className="lead__booking" src={bookingSrc ?? undefined} title="Book a time for your free billing review" loading="lazy" />
          </>
        )}
      </div>
    );
  }

  return (
    <form className="leadf" id="lead" onSubmit={onSubmit} noValidate aria-labelledby={`${id}-title`}>
      <h3 className="lead__title" id={`${id}-title`}>
        {LEAD_COPY.title}
      </h3>

      <div className="lead__fields">
        {FIELDS.map((f) => (
          <div key={f.key} className={`lead__field ${errors[f.key] ? 'lead__field--error' : ''}`}>
            <label htmlFor={`${id}-${f.key}`} className="lead__label">
              {f.label}
              {!f.required && <span className="lead__opt"> (optional)</span>}
            </label>
            <input
              id={`${id}-${f.key}`}
              className="lead__input"
              type={f.type}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              required={f.required}
              value={fields[f.key]}
              placeholder={f.key === 'phone' ? 'Optional' : undefined}
              aria-invalid={errors[f.key] ? true : undefined}
              aria-describedby={errors[f.key] ? `${id}-${f.key}-err` : undefined}
              onChange={(e) => set(f.key, e.target.value)}
            />
            {errors[f.key] && (
              <p className="lead__err" id={`${id}-${f.key}-err`}>
                <IconAlert size={16} />
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div className="lead__hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} type="text" tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => set('website', e.target.value)} />
      </div>

      <label className="lead__check">
        <input type="checkbox" checked={fields.includeNumbers} onChange={(e) => set('includeNumbers', e.target.checked)} />
        <span className="lead__box" aria-hidden="true">
          {fields.includeNumbers && <IconCheck size={14} />}
        </span>
        {LEAD_COPY.includeNumbers}
      </label>

      <button type="submit" className="btn btn--primary btn--block" disabled={sending}>
        {sending ? LEAD_COPY.sending : LEAD_COPY.submit}
      </button>
      <p className="lead__consent">{LEAD_COPY.consent}</p>

      {outcome?.kind === 'mailto' && (
        <p className="lead__msg" role="status">
          {LEAD_COPY.mailtoTitle} <a href={outcome.href}>{LEAD_COPY.mailtoRetry}</a>.
        </p>
      )}
      {outcome?.kind === 'error' && (
        <p className="lead__msg lead__msg--error" role="alert">
          {LEAD_COPY.errorTitle} {outcome.mailto ? <a href={outcome.mailto}>{LEAD_COPY.errorFallback}</a> : LEAD_COPY.errorNoFallback}
        </p>
      )}
    </form>
  );
}
