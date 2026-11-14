import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  isPlaceholder,
  LEAD_CONFIG,
  LEAD_FLOW,
  SITE,
  type ContactMethod,
  type LeadTile,
  type ScorecardInputs,
  type ScorecardResult,
  type TileIcon,
} from '../engine';
import {
  buildLeadPayload,
  EMPTY_ANSWERS,
  enabledScreens,
  formatUsPhone,
  needsPhone,
  reachLine,
  sendLead,
  softwareTiles,
  successReachLine,
  toggleMethod,
  validateDetails,
  type DetailsErrors,
  type DetailsField,
  type LeadAnswers,
  type LeadContext,
  type ScreenId,
  type SendOutcome,
} from '../lib/lead';
import {
  IconAlert,
  IconArrowLeft,
  IconBuilding,
  IconChat,
  IconCheck,
  IconMail,
  IconMix,
  IconPhone,
  IconUser,
  IconUsers,
} from './Icons';

/** A single-choice tap moves on by itself after this long, so the visitor sees their pick land. */
export const AUTO_ADVANCE_MS = 250;

const ICONS: Record<TileIcon, (p: { size?: number }) => JSX.Element> = {
  staff: IconUsers,
  company: IconBuilding,
  self: IconUser,
  mix: IconMix,
  call: IconPhone,
  text: IconChat,
  email: IconMail,
};

const on = <Id extends string>(tiles: readonly LeadTile<Id>[]) => tiles.filter((t) => t.on);

interface Props {
  result: ScorecardResult;
  inputs: ScorecardInputs;
  context: LeadContext;
}

/**
 * The lead flow (replaces the old contact form): one question per screen, in the paper panel of
 * the "Next step" section. Every word comes from LEAD_FLOW in src/engine/config.ts.
 * Nothing is sent until "Send my report"; the scorecard numbers only if the visitor picks
 * "Yes, attach my scorecard". The booking calendar loads only on the success screen.
 */
export function LeadFlow({ result, inputs, context }: Props) {
  const F = LEAD_FLOW;
  const uid = useId();
  const screens = useMemo(() => enabledScreens(), []);
  const [index, setIndex] = useState(0);
  const [a, setA] = useState<LeadAnswers>(EMPTY_ANSWERS);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const screen: ScreenId = screens[Math.min(index, screens.length - 1)]!;
  const last = screens.length - 1;
  const done = outcome?.kind === 'sent' || outcome?.kind === 'spam';
  const titleId = `${uid}-title`;

  const set = (patch: Partial<LeadAnswers>) => setA((prev) => ({ ...prev, ...patch }));
  const clearError = (f: DetailsField) =>
    setErrors((x) => {
      if (!(f in x)) return x;
      const next = { ...x };
      delete next[f];
      return next;
    });
  const go = (to: number) => {
    window.clearTimeout(timer.current);
    moved.current = true;
    setIndex(Math.max(0, Math.min(last, to)));
  };
  const advance = () => {
    window.clearTimeout(timer.current);
    moved.current = true;
    setIndex((i) => Math.min(last, i + 1));
  };
  const back = () => index > 0 && go(index - 1);
  /** Single choice: save, then move on after AUTO_ADVANCE_MS. */
  const pick = (patch: Partial<LeadAnswers>) => {
    set(patch);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(advance, AUTO_ADVANCE_MS);
  };

  // After each move: keep the panel's top in view and put focus on the new question.
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const root = rootRef.current;
    if (root) {
      const top = root.getBoundingClientRect().top;
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      if (top < bar || top > window.innerHeight * 0.6) root.scrollIntoView({ block: 'start' });
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  /* ------------------------------ Screens ------------------------------ */

  type TileModel = { id: string; label: string; icon?: TileIcon | undefined; badge?: string | undefined };
  const tilesFor = (s: ScreenId): { tiles: TileModel[]; selected: (id: string) => boolean; onPick: (id: string) => void; multi?: boolean } | null => {
    switch (s) {
      case 'billingHandler':
        return { tiles: on(F.billingHandler.tiles), selected: (id) => a.billingHandler === id, onPick: (id) => pick({ billingHandler: id as LeadAnswers['billingHandler'] }) };
      case 'providers':
        return { tiles: on(F.providers.tiles), selected: (id) => a.providers === id, onPick: (id) => pick({ providers: id as LeadAnswers['providers'] }) };
      case 'software':
        return {
          tiles: softwareTiles(context.specialty),
          selected: (id) => a.software === id,
          onPick: (id) => {
            if (id === 'other') {
              // "Something else" opens a small text field instead of moving on.
              window.clearTimeout(timer.current);
              set({ software: 'other' });
              window.requestAnimationFrame(() => document.getElementById(`${uid}-other`)?.focus());
            } else pick({ software: id as LeadAnswers['software'] });
          },
        };
      case 'timing':
        return { tiles: on(F.timing.tiles), selected: (id) => a.timing === id, onPick: (id) => pick({ timing: id as LeadAnswers['timing'] }) };
      case 'review':
        return {
          tiles: on(F.review.tiles).map((t) => ({ ...t, badge: t.id === 'yes' && F.review.recommended.on ? F.review.recommended.text : undefined })),
          selected: (id) => a.review === id,
          onPick: (id) => pick({ review: id as LeadAnswers['review'] }),
        };
      case 'contact':
        return {
          tiles: on(F.contact.tiles),
          selected: (id) => a.methods.includes(id as ContactMethod),
          onPick: (id) => setA((prev) => ({ ...prev, methods: toggleMethod(prev.methods, id as ContactMethod) })),
          multi: true,
        };
      case 'details':
        return null;
    }
  };
  const tiles = tilesFor(screen);

  const titles: Record<ScreenId, string> = {
    billingHandler: F.billingHandler.title,
    providers: F.providers.title,
    software: F.software.title,
    timing: F.timing.title,
    review: F.review.title,
    contact: F.contact.title,
    details: F.details.title,
  };
  const notes: Partial<Record<ScreenId, string>> = {
    ...(F.billingHandler.note.on ? { billingHandler: F.billingHandler.note.text } : {}),
    ...(F.review.note.on ? { review: F.review.note.text } : {}),
  };

  /** "Continue" is shown where a tap doesn't move on by itself. */
  const showContinue = screen === 'contact' || (screen === 'software' && a.software === 'other');
  const continueLabel = screen === 'contact' ? F.contact.continueLabel : F.software.continueLabel;

  /* ------------------------------ Send ------------------------------ */

  const FIELD_ORDER: DetailsField[] = ['name', 'practiceName', 'email', 'phone'];
  const submit = async () => {
    if (sending) return;
    const errs = validateDetails(a);
    setErrors(errs);
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setSending(true);
    const payload = buildLeadPayload(a, context, result, inputs);
    const out = await sendLead(a, payload, { endpoint: LEAD_CONFIG.formEndpoint, contactEmail: SITE.contactEmail });
    setSending(false);
    setOutcome(out);
    if (out.kind === 'mailto') window.location.href = out.href;
  };

  /* ------------------------------ Keyboard ------------------------------ */

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA';
    // Number keys 1 to 8 pick a tile.
    if (!typing && tiles && /^[1-8]$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const tile = tiles.tiles[Number(e.key) - 1];
      if (tile) {
        e.preventDefault();
        tiles.onPick(tile.id);
      }
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (screen === 'details') return; // the form's own submit handles Enter
    if (typing) return; // a text field handles its own Enter
    if (t.tagName === 'BUTTON' || t.tagName === 'A') return; // Enter on a tile or link is its own click
    const answered =
      screen === 'contact' ||
      (screen === 'software' && a.software === 'other') ||
      (tiles?.tiles.some((x) => tiles.selected(x.id)) ?? false);
    if (answered) {
      e.preventDefault();
      advance();
    }
  };

  /* ------------------------------ Render ------------------------------ */

  const booking = isPlaceholder(SITE.bookingLink) ? null : SITE.bookingLink;
  if (done) {
    const firstName = a.name.trim().split(/\s+/)[0] ?? '';
    // Calendly renders as an inline widget when told so; other booking tools get the plain link.
    const bookingSrc =
      booking && /(^|\.)calendly\.com$/.test(new URL(booking).hostname)
        ? `${booking}${booking.includes('?') ? '&' : '?'}embed_type=Inline&embed_domain=${encodeURIComponent(window.location.hostname)}&hide_gdpr_banner=1`
        : booking;
    return (
      <div className="lf lf--done" id="lead" ref={doneRef} tabIndex={-1} role="status">
        <span className="lf__doneicon" aria-hidden="true">
          <IconCheck size={22} />
        </span>
        <p className="lf__donetitle">{F.success.title(firstName)}</p>
        <p className="lf__donereach">{successReachLine(a.methods)}</p>
        {booking && F.success.booking.on && (
          <>
            <p className="lf__booktitle">{F.success.booking.text}</p>
            {/* Loaded only now: no third-party frame is requested before the visitor sends. */}
            <iframe className="lf__booking" src={bookingSrc ?? undefined} title="Pick a time for your free billing review" />
          </>
        )}
      </div>
    );
  }

  const answeredCount = index;
  const almostDone = F.progress.almostDone.on && index >= last - 1;
  const pct = Math.round(((index + 1) / (screens.length + 1)) * 100);
  const sideItems = F.sidePanel.items.filter((x) => x.on);

  return (
    <div className="lf" id="lead" ref={rootRef} onKeyDown={onKeyDown}>
      <div className="lf__main">
        <div className="lf__top">
          <div className="lf__bar" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} {...(almostDone ? { 'aria-valuetext': F.progress.almostDone.text } : {})}>
            <span className="lf__fill" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className="lf__toprow">
            {index > 0 ? (
              <button type="button" className="lf__back" onClick={back}>
                <IconArrowLeft size={18} />
                {F.back}
              </button>
            ) : (
              <span />
            )}
            {almostDone && <span className="lf__almost">{F.progress.almostDone.text}</span>}
          </div>
        </div>

        <div className="lf__screen" key={screen} data-screen={screen}>
          <h3 className="lf__title" id={titleId} ref={titleRef} tabIndex={-1}>
            {titles[screen]}
          </h3>

          {tiles && (
            <div className="lf__tiles" role="group" aria-labelledby={titleId}>
              {tiles.tiles.map((t, i) => {
                const sel = tiles.selected(t.id);
                const Icon = t.icon ? ICONS[t.icon] : null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`lf__tile ${sel ? 'lf__tile--on' : ''} ${Icon ? 'lf__tile--icon' : ''}`}
                    aria-pressed={sel}
                    onClick={() => tiles.onPick(t.id)}
                  >
                    {Icon && (
                      <span className="lf__icon" aria-hidden="true">
                        <Icon size={22} />
                      </span>
                    )}
                    <span className="lf__label">
                      {t.label}
                      {t.badge && <span className="lf__badge">{t.badge}</span>}
                    </span>
                    <span className="lf__check" aria-hidden="true">
                      <IconCheck size={16} />
                    </span>
                    <kbd className="lf__key" aria-hidden="true">
                      {i + 1}
                    </kbd>
                  </button>
                );
              })}
            </div>
          )}

          {screen === 'software' && a.software === 'other' && (
            <div className="lf__field lf__field--other">
              <label className="lf__label2" htmlFor={`${uid}-other`}>
                {F.software.otherLabel}
              </label>
              <input
                id={`${uid}-other`}
                className="lf__input"
                type="text"
                autoComplete="off"
                placeholder={F.software.otherPlaceholder}
                value={a.softwareOther}
                onChange={(e) => set({ softwareOther: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    advance();
                  }
                }}
              />
            </div>
          )}

          {notes[screen] && <p className="lf__note">{notes[screen]}</p>}

          {showContinue && (
            <button type="button" className="btn btn--primary lf__continue" onClick={advance}>
              {continueLabel}
            </button>
          )}

          {screen === 'details' && (
            <form
              className="lf__form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Field id={`${uid}-name`} label={F.details.name} error={errors.name}>
                {(p) => <input {...p} type="text" autoComplete="name" value={a.name} onChange={(e) => { set({ name: e.target.value }); clearError('name'); }} />}
              </Field>
              <Field id={`${uid}-practiceName`} label={F.details.practiceName} error={errors.practiceName}>
                {(p) => <input {...p} type="text" autoComplete="organization" value={a.practiceName} onChange={(e) => { set({ practiceName: e.target.value }); clearError('practiceName'); }} />}
              </Field>
              <Field id={`${uid}-email`} label={F.details.email} error={errors.email} hint={F.details.emailHint.on ? F.details.emailHint.text : undefined}>
                {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={a.email} onChange={(e) => { set({ email: e.target.value }); clearError('email'); }} />}
              </Field>
              {needsPhone(a.methods) && (
                <Field
                  id={`${uid}-phone`}
                  label={F.details.phone}
                  error={errors.phone}
                  hint={a.methods.includes('text') && F.details.phoneTextHint.on ? F.details.phoneTextHint.text : undefined}
                >
                  {(p) => (
                    <input
                      {...p}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder={F.details.phonePlaceholder}
                      value={a.phone}
                      onChange={(e) => {
                        set({ phone: formatUsPhone(e.target.value) });
                        clearError('phone');
                      }}
                    />
                  )}
                </Field>
              )}

              {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
              <div className="lf__hp" aria-hidden="true">
                <label htmlFor={`${uid}-website`}>Website</label>
                <input id={`${uid}-website`} type="text" tabIndex={-1} autoComplete="off" value={a.website} onChange={(e) => set({ website: e.target.value })} />
              </div>

              <p className="lf__reach">{reachLine(a.methods)}</p>
              <button type="submit" className="btn btn--primary btn--block lf__send" disabled={sending}>
                {sending ? F.details.sending : F.details.submit}
              </button>
              {F.details.consent.on && <p className="lf__consent">{F.details.consent.text}</p>}

              {outcome?.kind === 'mailto' && (
                <p className="lf__msg" role="status">
                  {F.failure.mailtoTitle} <a href={outcome.href}>{F.failure.mailtoRetry}</a>.
                </p>
              )}
              {outcome?.kind === 'error' && (
                <p className="lf__msg lf__msg--error" role="alert">
                  {F.failure.errorTitle} {outcome.mailto ? <a href={outcome.mailto}>{F.failure.errorFallback}</a> : F.failure.errorNoFallback}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {F.sidePanel.on && (
        <aside className="lf__side" aria-label={F.sidePanel.title}>
          <p className="lf__sidetitle">{F.sidePanel.title}</p>
          <ul className="lf__sidelist">
            {sideItems.map((item) => {
              const ticked = answeredCount >= item.after;
              return (
                <li key={item.text} className={ticked ? 'lf__sideitem lf__sideitem--on' : 'lf__sideitem'}>
                  <span className="lf__tick" aria-hidden="true">
                    {ticked && <IconCheck size={14} />}
                  </span>
                  {item.text}
                </li>
              );
            })}
          </ul>
          {F.sidePanel.footer.on && <p className="lf__sidefoot">{F.sidePanel.footer.text}</p>}
        </aside>
      )}
    </div>
  );
}

/** One labeled field on the details screen, with its hint and its error under it. */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  hint?: string | undefined;
  children: (p: { id: string; className: string; required: true; 'aria-invalid'?: true; 'aria-describedby'?: string }) => JSX.Element;
}) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ');
  return (
    <div className={`lf__field ${error ? 'lf__field--error' : ''}`}>
      <label htmlFor={id} className="lf__label2">
        {label}
      </label>
      {children({
        id,
        className: 'lf__input',
        required: true,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {hint && (
        <p className="lf__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="lf__err" id={`${id}-err`}>
          <IconAlert size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
