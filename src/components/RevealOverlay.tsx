import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { METRIC_ORDER, METRICS, type ScorecardResult, type Specialty } from '../engine';
import { RATE_LINE, REVEAL_TOTAL_LABEL, SPECIALTY_LABEL } from '../content/copy';
import { formatMetric, formatMoney, preparedDate } from '../lib/format';
import { useCountUp } from '../lib/tween';

/*
 * Timeline (DESIGN-BRIEF 7.5), about 2.5 seconds:
 *   0 ms     the statement settles in the center (fills the screen on phones)
 *   400 ms   a hairline draws under the last line (300 ms)
 *   700 ms   the total row slides in; the jade figure counts up from $0 (900 ms, ease-out)
 *   1650 ms  the grade lands (scale 1.15 to 1, 250 ms) with one light vibration on phones
 *   2600 ms  the overlay closes and the page settles on the results
 * "Skip" (or Escape) jumps to the end. Reduced motion shows the final state at once.
 */
const T_RULE = 400;
const T_TOTAL = 700;
const T_GRADE = 1650;
const T_DONE = 2600;
const T_DONE_REDUCED = 1600;

const STATUS_WORD = { good: 'Good', watch: 'Watch', problem: 'Problem' } as const;

interface Props {
  result: ScorecardResult;
  specialty: Specialty | null;
  onDone: () => void;
}

export function RevealOverlay({ result, specialty, onDone }: Props) {
  const reduce = !!useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  const skipRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };

  const card = result.headlineCard;
  const target = card?.vsTop.rounded ?? 0;
  const counted = useCountUp(target, phase >= 2, 0.9);
  const shown = phase >= 3 ? target : Math.round(counted);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const timers = reduce
      ? [window.setTimeout(finish, T_DONE_REDUCED)]
      : [
          window.setTimeout(() => setPhase(1), T_RULE),
          window.setTimeout(() => setPhase(2), T_TOTAL),
          window.setTimeout(() => {
            setPhase(3);
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
          }, T_GRADE),
          window.setTimeout(finish, T_DONE),
        ];
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('keydown', onKey);
      root.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const today = preparedDate();
  const specialtyLabel = specialty ? SPECIALTY_LABEL[specialty] : undefined;
  const letter = result.overall.letter;
  const score = result.overall.score;
  const summary =
    (letter ? `Your grade is ${letter}, ${score?.toFixed(1)} out of 100.` : 'Not enough numbers for a letter grade.') +
    (card ? ` ${REVEAL_TOTAL_LABEL[card.id]}: ${formatMoney(target)}.` : '');

  return (
    <div className="reveal2" role="dialog" aria-modal="true" aria-labelledby="reveal-title">
      <div className={`reveal2__sheet ${reduce ? '' : 'reveal2__sheet--in'}`}>
        <div className="reveal2__head">
          <div>
            <p className="reveal2__title" id="reveal-title">
              Your billing statement
            </p>
            <p className="reveal2__meta">
              Prepared {today}
              {specialtyLabel ? ` · ${specialtyLabel}` : ''}
            </p>
          </div>
          <div className="reveal2__grade" aria-hidden="true">
            {phase >= 3 && (
              <>
                {letter ? (
                  <span className={`reveal2__letter ${reduce ? '' : 'reveal2__letter--land'}`}>{letter}</span>
                ) : (
                  <span className="reveal2__nograde">No grade</span>
                )}
                <span className="reveal2__score">{score !== null ? `${score.toFixed(1)} / 100` : 'Too few graded numbers'}</span>
              </>
            )}
          </div>
        </div>

        <ul className="reveal2__rows">
          {METRIC_ORDER.map((id) => {
            const m = result.metrics[id];
            return (
              <li key={id} className="reveal2__row">
                <span className="reveal2__name">{RATE_LINE[id]}</span>
                <span className={`reveal2__value ${m.value === null ? 'reveal2__value--muted' : ''}`}>
                  {m.value === null ? 'Not reported' : formatMetric(m.value, METRICS[id].unit)}
                </span>
                {m.status ? (
                  <span className={`sdot sdot--${m.status}`}>
                    <i aria-hidden="true" />
                    {STATUS_WORD[m.status]}
                  </span>
                ) : (
                  <span className="reveal2__nostatus">{m.availability === 'notGraded' ? 'Not graded' : ''}</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className={`reveal2__rule ${phase >= 1 ? 'reveal2__rule--on' : ''}`} aria-hidden="true" />

        <div className={`reveal2__total ${phase >= 2 ? 'reveal2__total--on' : ''}`}>
          {card ? (
            <>
              <span className="reveal2__total-label">{REVEAL_TOTAL_LABEL[card.id]}</span>
              <span className="reveal2__money">{formatMoney(shown)}</span>
            </>
          ) : (
            <span className="reveal2__total-label">Your numbers are at top-practice levels.</span>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {phase >= 3 ? summary : ''}
        </p>
      </div>

      <button type="button" ref={skipRef} className="reveal2__skip" onClick={finish}>
        Skip
      </button>
    </div>
  );
}
