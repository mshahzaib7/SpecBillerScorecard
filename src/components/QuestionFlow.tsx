import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MESSAGES,
  PAIN_POINTS,
  UNKNOWN_ALLOWED_FIELDS,
  type InputField,
  type NumericField,
  type PainPointId,
  type ScorecardResult,
  type Specialty,
} from '../engine';
import {
  ATTORNEY_QUESTION,
  DONT_HAVE_LABEL,
  NOT_REPORTED_NOTE,
  PAIN_QUESTION,
  QUESTION_COPY,
  SPECIALTY_QUESTION,
  SPECIALTY_TILES,
} from '../content/copy';
import { caretAfterSignificant, significantBefore } from '../lib/format';
import { fieldMessage, FORMAT_MESSAGES, formatNumberInput } from '../lib/inputRules';
import type { FormState } from '../lib/formState';
import { IconAlert, IconArrowRight, IconCheck, IconChevronDown } from './Icons';
import { ReportMock } from './ReportMock';

export type Question =
  | { kind: 'specialty' }
  | { kind: 'pain' }
  | { kind: 'attorney' }
  | { kind: 'number'; field: NumericField };

const MONEY_FIELDS: readonly NumericField[] = ['charges3', 'adjustments3', 'payments3', 'totalAR', 'ar90'];

/** Question order (DESIGN-BRIEF 7.4). Specialty only if it wasn't picked in the hero. */
export function buildQuestions(askSpecialty: boolean, specialty: Specialty | null): Question[] {
  const n = (field: NumericField): Question => ({ kind: 'number', field });
  return [
    ...(askSpecialty ? [{ kind: 'specialty' } as Question] : []),
    { kind: 'pain' },
    n('charges3'),
    n('adjustments3'),
    n('payments3'),
    n('claimsSubmitted3'),
    n('claimsDenied3'),
    n('claimsPaidFirstPass3'),
    ...(specialty === 'accident' ? [{ kind: 'attorney' } as Question] : []),
    n('totalAR'),
    n('ar90'),
  ];
}

const fieldsOf = (q: Question): InputField[] =>
  q.kind === 'number' ? [q.field] : q.kind === 'specialty' ? ['specialty'] : q.kind === 'attorney' ? ['arIncludesAttorneyCases'] : [];

const keyOf = (q: Question) => (q.kind === 'number' ? q.field : q.kind);

/** Empty-field messages wait for "Next"; the rest show once the visitor leaves the field. */
const EMPTY_MESSAGES: string[] = [MESSAGES.required, MESSAGES.requiredOrUnknown, MESSAGES.specialtyRequired, MESSAGES.attorneyRequired];

/** Visitor-facing wording for a validation message (number fields use src/lib/inputRules.ts). */
function friendly(message: string, field: InputField): string {
  if (NUMERIC.includes(field as NumericField)) return fieldMessage(message, field as NumericField, DONT_HAVE_LABEL);
  return message;
}
const NUMERIC: readonly InputField[] = ['charges3', 'adjustments3', 'payments3', 'claimsSubmitted3', 'claimsDenied3', 'claimsPaidFirstPass3', 'totalAR', 'ar90'];

interface Props {
  form: FormState;
  setForm: (updater: (f: FormState) => FormState) => void;
  questions: Question[];
  step: number;
  setStep: (s: number) => void;
  result: ScorecardResult;
  onSubmit: () => void;
  submitLabel: string;
}

export function QuestionFlow({ form, setForm, questions, step, setStep, result, onSubmit, submitLabel }: Props) {
  const reduce = useReducedMotion();
  const q = questions[Math.min(step, questions.length - 1)]!;
  const key = keyOf(q);
  const [attempted, setAttempted] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Partial<Record<InputField, boolean>>>({});
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const autoTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(autoTimer.current), []);

  const { errors, warnings } = result.validation;
  const errorFor = (f: InputField): string | null => {
    const e = errors.find((x) => x.field === f);
    if (!e) return null;
    if (attempted[key]) return friendly(e.message, f);
    // A badly written number is flagged at once, while typing; other messages wait for leaving the field.
    if (FORMAT_MESSAGES.includes(e.message)) return friendly(e.message, f);
    if (touched[f] && !EMPTY_MESSAGES.includes(e.message)) return friendly(e.message, f);
    return null;
  };
  const warningFor = (f: InputField): string | null =>
    touched[f] || attempted[key] ? warnings.find((x) => x.field === f)?.message ?? null : null;

  // After moving between questions: keep the card in view and move focus into it.
  // useLayoutEffect: runs before the browser can deliver the next keystroke, so none is lost.
  useLayoutEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    const card = cardRef.current;
    if (card) {
      const top = card.getBoundingClientRect().top;
      const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 64;
      if (top < bar || top > window.innerHeight * 0.5) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
    // Number questions share one persistent input, so it usually already has focus. Coming from a
    // choice question, focus it on this same render, before the next keystroke can arrive.
    const input = q.kind === 'number' ? card?.querySelector<HTMLInputElement>('.nq__input:not(:disabled)') : null;
    (input ?? titleRef.current)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduce]);

  const go = (to: number) => {
    moved.current = true;
    setStep(to);
  };

  const next = () => {
    const errs = errors.filter((e) => fieldsOf(q).includes(e.field));
    if (errs.length > 0) {
      setAttempted((a) => ({ ...a, [key]: true }));
      requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (step < questions.length - 1) {
      go(step + 1);
      return;
    }
    // Last question: any error left on an earlier question sends the visitor back to it.
    const bad = questions.findIndex((x) => errors.some((e) => fieldsOf(x).includes(e.field)));
    if (bad !== -1) {
      setAttempted((a) => ({ ...a, [keyOf(questions[bad]!)]: true }));
      go(bad);
      return;
    }
    onSubmit();
  };
  const back = () => step > 0 && go(step - 1);

  const pickThenAdvance = (apply: (f: FormState) => FormState) => {
    setForm(apply);
    window.clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => go(step + 1), reduce ? 0 : 260);
  };

  const togglePain = (id: PainPointId) =>
    setForm((s) => ({ ...s, painPoints: s.painPoints.includes(id) ? s.painPoints.filter((p) => p !== id) : [...s.painPoints, id] }));

  const isLast = step === questions.length - 1;
  const total = questions.length;
  const nextLabel = isLast ? submitLabel : q.kind === 'pain' && form.painPoints.length === 0 ? 'Skip' : 'Next';

  let title = '';
  let hint = '';
  if (q.kind === 'number') ({ label: title, hint } = QUESTION_COPY[q.field]);
  else if (q.kind === 'pain') ({ label: title, hint } = PAIN_QUESTION);
  else if (q.kind === 'specialty') ({ label: title, hint } = SPECIALTY_QUESTION);
  else ({ label: title, hint } = ATTORNEY_QUESTION);

  return (
    <div className="q" ref={cardRef}>
      <div className="q__progress">
        <span className="q__count">
          Question {step + 1} of {total}
        </span>
        <div
          className="q__track"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
          aria-valuetext={`Question ${step + 1} of ${total}`}
        >
          <span className="q__fill" style={{ transform: `scaleX(${(step + 1) / total})` }} />
        </div>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            back();
          }
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={key}
            data-qkey={key}
            className="q__body"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h2 className="q__title" id="q-title" ref={titleRef} tabIndex={-1}>
              {title}
            </h2>
            <p className="q__hint" id="q-hint">{hint}</p>

            {q.kind === 'pain' && (
              <div className="pains" role="group" aria-labelledby="q-title">
                {PAIN_POINTS.map((p) => {
                  const on = form.painPoints.includes(p.id);
                  return (
                    <button type="button" key={p.id} className={`pain ${on ? 'pain--on' : ''}`} aria-pressed={on} onClick={() => togglePain(p.id)}>
                      <span className="pain__box" aria-hidden="true">
                        {on && <IconCheck size={14} />}
                      </span>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            {q.kind === 'specialty' && (
              <ChoiceTiles
                options={SPECIALTY_TILES.map((t) => ({ id: t.id, label: t.label }))}
                value={form.specialty}
                error={errorFor('specialty')}
                onPick={(id) => pickThenAdvance((f) => ({ ...f, specialty: id as Specialty }))}
              />
            )}

            {q.kind === 'attorney' && (
              <ChoiceTiles
                options={[
                  { id: 'yes', label: ATTORNEY_QUESTION.yes },
                  { id: 'no', label: ATTORNEY_QUESTION.no },
                ]}
                value={form.arIncludesAttorneyCases === null ? null : form.arIncludesAttorneyCases ? 'yes' : 'no'}
                error={errorFor('arIncludesAttorneyCases')}
                onPick={(id) => pickThenAdvance((f) => ({ ...f, arIncludesAttorneyCases: id === 'yes' }))}
              />
            )}
          </m.div>
        </AnimatePresence>

        {/*
          One persistent input for every number question: it never unmounts between them (only its
          label, value and help change), so focus never moves and no keystroke can be lost.
        */}
        {q.kind === 'number' && (
          <NumberQuestion
            key="number-input"
            field={q.field}
            value={form.values[q.field]}
            unknown={form.unknown[q.field]}
            valid={!errors.some((e) => e.field === q.field) && (form.values[q.field] !== '' || form.unknown[q.field])}
            error={errorFor(q.field)}
            warning={warningFor(q.field)}
            onChange={(v) => setForm((s) => ({ ...s, values: { ...s.values, [q.field]: v } }))}
            onUnknown={(u) => setForm((s) => ({ ...s, unknown: { ...s.unknown, [q.field]: u } }))}
            onBlur={() => setTouched((t) => ({ ...t, [q.field]: true }))}
          />
        )}

        <div className="q__nav">
          {step > 0 ? (
            <button type="button" className="q__back" onClick={back}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn--primary q__next">
            {nextLabel}
            <IconArrowRight size={20} />
          </button>
        </div>
        <p className="q__keys" aria-hidden="true">
          Enter to continue · Shift + Enter to go back
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface NumberProps {
  field: NumericField;
  value: string;
  unknown: boolean;
  valid: boolean;
  error: string | null;
  warning: string | null;
  onChange: (v: string) => void;
  onUnknown: (u: boolean) => void;
  onBlur: () => void;
}

function NumberQuestion({ field, value, unknown, valid, error, warning, onChange, onUnknown, onBlur }: NumberProps) {
  const id = useId();
  const money = MONEY_FIELDS.includes(field);
  const optional = UNKNOWN_ALLOWED_FIELDS.includes(field);
  const [open, setOpen] = useState(false);
  // The input persists across questions; the "Where's this?" mock closes when the question changes.
  useEffect(() => setOpen(false), [field]);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Keep the caret in place while commas are inserted.
  useLayoutEffect(() => {
    if (caret.current !== null && inputRef.current && document.activeElement === inputRef.current) {
      const pos = caretAfterSignificant(inputRef.current.value, caret.current);
      inputRef.current.setSelectionRange(pos, pos);
    }
    caret.current = null;
  }, [value]);

  const mockId = `${id}-mock`;
  const msgId = `${id}-msg`;
  const describedBy = useMemo(() => ['q-hint', error || warning ? msgId : ''].filter(Boolean).join(' '), [error, warning, msgId]);

  return (
    <div className={`nq ${error ? 'nq--error' : ''} ${unknown ? 'nq--unknown' : ''}`}>
      <label htmlFor={id} className="sr-only">
        {QUESTION_COPY[field].line}
      </label>
      <div className="nq__control">
        {money && (
          <span className="nq__prefix" aria-hidden="true">
            $
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          name={field}
          className={`nq__input ${money ? 'nq__input--money' : ''}`}
          type="text"
          inputMode={money ? 'decimal' : 'numeric'}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={unknown ? 'Not reported' : money ? '0' : '0'}
          value={unknown ? '' : value}
          disabled={unknown}
          onChange={(e) => {
            const raw = e.target.value;
            // Typed or pasted text follows the same rules; invalid text is kept exactly as typed.
            const next = formatNumberInput(raw, money ? 'money' : 'count');
            caret.current = next === raw ? null : significantBefore(raw, e.target.selectionStart ?? raw.length);
            onChange(next);
          }}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {valid && !unknown && (
          <span className="nq__ok" aria-hidden="true">
            <IconCheck size={18} />
          </span>
        )}
      </div>

      {(error || warning) && (
        <p className={`nq__msg ${error ? 'nq__msg--error' : 'nq__msg--warn'}`} id={msgId} role={error ? 'alert' : 'status'}>
          <IconAlert size={16} />
          {error ?? warning}
        </p>
      )}

      <div className="nq__tools">
        <button type="button" className="nq__where" aria-expanded={open} aria-controls={mockId} onClick={() => setOpen((o) => !o)}>
          Where's this?
          <IconChevronDown size={16} className={open ? 'nq__chev nq__chev--open' : 'nq__chev'} />
        </button>
        {optional && (
          <label className="nq__dont">
            <input type="checkbox" checked={unknown} onChange={(e) => onUnknown(e.target.checked)} />
            <span className="nq__box" aria-hidden="true">
              {unknown && <IconCheck size={14} />}
            </span>
            {DONT_HAVE_LABEL}
          </label>
        )}
      </div>
      {unknown && <p className="nq__note">{NOT_REPORTED_NOTE}</p>}
      {open ? <ReportMock field={field} id={mockId} /> : <span id={mockId} hidden />}
    </div>
  );
}

function ChoiceTiles({
  options,
  value,
  error,
  onPick,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  error: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <div className="choices2" role="group" aria-labelledby="q-title">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button key={o.id} type="button" className={`tile tile--light ${on ? 'tile--on' : ''}`} aria-pressed={on} onClick={() => onPick(o.id)}>
              <span className="tile__label">{o.label}</span>
              <span className="tile__check" aria-hidden="true">
                <IconCheck size={18} />
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="nq__msg nq__msg--error" role="alert">
          <IconAlert size={16} />
          {error}
        </p>
      )}
    </>
  );
}
