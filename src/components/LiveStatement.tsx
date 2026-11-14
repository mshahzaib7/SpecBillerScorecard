import { useReducedMotion } from 'framer-motion';
import { Anim } from '../lib/motion';
import { useEffect, useRef, useState } from 'react';
import { METRICS, type MetricId, type NumericField, type ScorecardResult } from '../engine';
import { NOT_REPORTED_NOTE, QUESTION_COPY, RATE_LINE, SPECIALTY_LABEL } from '../content/copy';
import { formatMetric, preparedDate } from '../lib/format';
import type { FormState } from '../lib/formState';
import { IconChevronDown } from './Icons';

/** Which inputs each rate depends on. A rate line appears once all of them are in and valid. */
const RATE_DEPS: Record<MetricId, NumericField[]> = {
  ncr: ['charges3', 'adjustments3', 'payments3'],
  den: ['claimsSubmitted3', 'claimsDenied3'],
  fpr: ['claimsSubmitted3', 'claimsPaidFirstPass3'],
  dar: ['charges3', 'totalAR'],
  ar90: ['totalAR', 'ar90'],
};

/** Statement order: each rate sits right after the last input it needs. */
const ORDER: ({ field: NumericField } | { rate: MetricId })[] = [
  { field: 'charges3' },
  { field: 'adjustments3' },
  { field: 'payments3' },
  { rate: 'ncr' },
  { field: 'claimsSubmitted3' },
  { field: 'claimsDenied3' },
  { rate: 'den' },
  { field: 'claimsPaidFirstPass3' },
  { rate: 'fpr' },
  { field: 'totalAR' },
  { rate: 'dar' },
  { field: 'ar90' },
  { rate: 'ar90' },
];

const MONEY: readonly NumericField[] = ['charges3', 'adjustments3', 'payments3', 'totalAR', 'ar90'];

export interface StatementLine {
  key: string;
  label: string;
  value: string;
  kind: 'input' | 'rate';
  muted?: boolean;
  tag?: string | undefined;
  note?: string;
}

/** The lines of the visitor's statement so far (shared by the live sheet and the reveal). */
export function statementLines(form: FormState, result: ScorecardResult): StatementLine[] {
  const errs = new Set(result.validation.errors.map((e) => e.field));
  const has = (f: NumericField) => !errs.has(f) && (form.unknown[f] || form.values[f].trim() !== '');
  const lines: StatementLine[] = [];
  for (const item of ORDER) {
    if ('field' in item) {
      const f = item.field;
      if (!has(f)) continue;
      lines.push(
        form.unknown[f]
          ? { key: f, label: QUESTION_COPY[f].line, value: 'Not reported', kind: 'input', muted: true }
          : { key: f, label: QUESTION_COPY[f].line, value: (MONEY.includes(f) ? '$' : '') + form.values[f], kind: 'input' },
      );
    } else {
      const id = item.rate;
      const deps = RATE_DEPS[id];
      if (!deps.every(has)) continue;
      const m = result.metrics[id];
      if (m.value === null) {
        lines.push({ key: `r-${id}`, label: RATE_LINE[id], value: 'Not reported', kind: 'rate', muted: true, note: NOT_REPORTED_NOTE });
      } else {
        lines.push({
          key: `r-${id}`,
          label: RATE_LINE[id],
          value: formatMetric(m.value, METRICS[id].unit),
          kind: 'rate',
          tag: m.availability === 'notGraded' ? 'Not graded' : undefined,
        });
      }
    }
  }
  return lines;
}

/** Updated values flash a very light jade for 600ms (opacity-only animation). */
function FlashValue({ value, className }: { value: string; className: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash((n) => n + 1);
    }
  }, [value]);
  return (
    <span className={className}>
      {flash > 0 && <span key={flash} className="flash" aria-hidden="true" />}
      <span className="flash__text">{value}</span>
    </span>
  );
}

interface Props {
  form: FormState;
  result: ScorecardResult;
}

/**
 * "Your statement" (DESIGN-BRIEF 7.4). Desktop and tablet: a sticky paper sheet beside the questions.
 * Phones: a slim bar ("Your statement · 3 lines") that expands on tap.
 */
export function LiveStatement({ form, result }: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const lines = statementLines(form, result);
  const specialty = form.specialty ? SPECIALTY_LABEL[form.specialty] : undefined;
  const today = preparedDate();
  const count = `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`;

  return (
    <div className={`stmt ${open ? 'stmt--open' : ''}`}>
      <button type="button" className="stmt__bar" aria-expanded={open} aria-controls="stmt-sheet" onClick={() => setOpen((o) => !o)}>
        <span>
          Your statement <span className="stmt__barcount">· {count}</span>
        </span>
        <IconChevronDown size={18} className={open ? 'stmt__chev stmt__chev--open' : 'stmt__chev'} />
      </button>

      <div className="stmt__sheet" id="stmt-sheet">
        <div className="stmt__head">
          <p className="stmt__title">Your statement</p>
          <p className="stmt__meta">
            Prepared {today}
            {specialty ? ` · ${specialty}` : ''}
          </p>
        </div>
        {lines.length === 0 ? (
          <p className="stmt__empty">Your lines appear here as you answer.</p>
        ) : (
          <ul className="stmt__lines" aria-live="polite" aria-relevant="additions text">
            {lines.map((l) => (
              <Anim
                as="li"
                key={l.key}
                className={`stmt__line stmt__line--${l.kind} ${l.muted ? 'stmt__line--muted' : ''}`}
                motion={{
                  initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] },
                }}
              >
                <span className="stmt__label">{l.label}</span>
                <FlashValue value={l.value} className="stmt__value" />
                {l.tag && <span className="stmt__tag">{l.tag}</span>}
                {l.note && <span className="stmt__note">{l.note}</span>}
              </Anim>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
