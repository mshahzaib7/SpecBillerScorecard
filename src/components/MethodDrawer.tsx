import { useEffect, useRef } from 'react';
import {
  LETTER_THRESHOLDS,
  METRIC_ORDER,
  METRICS,
  MIN_METRICS_FOR_GRADE,
  PERIOD_DAYS,
  PERIOD_MONTHS,
  PERIODS_PER_YEAR,
  STATUS_THRESHOLDS,
} from '../engine';
import { METHOD_DRAWER as T } from '../content/closing';
import { METHOD_NOTE } from '../content/sections';
import { formatTarget } from '../lib/format';

/** Every number below is read from src/engine/config.ts; nothing is typed in twice. */
const FORMULAS: [string, string][] = [
  ['Net charges', 'charges − contractual adjustments'],
  ['Net ratio', 'net charges ÷ charges'],
  ['Average daily charges', `charges ÷ ${PERIOD_DAYS}`],
  ['Net collection rate', 'payments × 100 ÷ net charges'],
  ['Days in AR', `total AR × ${PERIOD_DAYS} ÷ charges`],
  ['AR over 90 days', 'AR older than 90 days × 100 ÷ total AR'],
  ['Denial rate', 'claims denied × 100 ÷ claims submitted'],
  ['First-pass rate', 'claims paid on the first try × 100 ÷ claims submitted'],
];

const MONEY: [string, string][] = [
  ['Uncollected money, per year', `net charges × ${PERIODS_PER_YEAR} × (target − your rate) ÷ 100`],
  ['Cash that could come in faster, one-time', '(your days in AR − target) × average daily charges × net ratio'],
  ['Denied claims above target, per month', `(claims denied − target % × claims submitted) ÷ ${PERIOD_MONTHS} × (charges ÷ claims submitted) × net ratio`],
  ['Money stuck over 90 days, right now', 'AR over 90 days × net ratio. Gap: (AR over 90 − target % × total AR) × net ratio'],
];

function RefTable({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mdraw__ref">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Methodology drawer (DESIGN-BRIEF 7.14): a right-side drawer (full screen on phones), opened from
 * the top bar, every "How we got this" and the footer. Escape or the backdrop closes it, focus
 * stays inside while open and returns to the opener afterwards.
 */
export function MethodDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('.mdraw__close')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      root.style.overflow = prev;
      (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mdraw" role="presentation">
      <div className="mdraw__backdrop" onClick={onClose} />
      <div className="mdraw__panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="mdraw-title">
        <div className="mdraw__head">
          <h2 className="mdraw__title" id="mdraw-title">
            {T.title}
          </h2>
          <button type="button" className="mdraw__close" onClick={onClose}>
            {T.close}
          </button>
        </div>

        <div className="mdraw__body" tabIndex={0}>
          <h3>{T.periodTitle}</h3>
          <p>
            Your report numbers cover the last {PERIOD_MONTHS} full months, which we treat as {PERIOD_DAYS} days. This is the standard 3-month
            method for days in AR. Yearly figures multiply the 3 months by {PERIODS_PER_YEAR}.
          </p>

          <h3>{T.formulasTitle}</h3>
          <RefTable rows={FORMULAS} />

          <h3>{T.moneyTitle}</h3>
          <RefTable rows={MONEY} />
          <p>Each estimate is compared with the Good target and with the top-performer target. Estimates are rounded to the nearest $100 and are never added together.</p>

          <h3>{T.targetsTitle}</h3>
          <div className="mdraw__scroll" tabIndex={0} role="region" aria-label={T.targetsTitle}>
            <table className="mdraw__table">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Good</th>
                  <th scope="col">Top</th>
                  <th scope="col">Anchors (value → score)</th>
                  <th scope="col">Weight</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ORDER.map((id) => {
                  const m = METRICS[id];
                  return (
                    <tr key={id}>
                      <th scope="row">{m.shortName}</th>
                      <td>{formatTarget(m.goodTarget, m.unit)}</td>
                      <td>{formatTarget(m.topTarget, m.unit)}</td>
                      <td>{m.anchors.map((a) => `${a.value}→${a.score}`).join(', ')}</td>
                      <td>{m.weight}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3>{T.gradingTitle}</h3>
          <p>
            Scores move in a straight line between anchors and stop at 0 and 100. A score of {STATUS_THRESHOLDS.good} or more is Good,{' '}
            {STATUS_THRESHOLDS.watch} up to {STATUS_THRESHOLDS.good} is Watch, and below {STATUS_THRESHOLDS.watch} is Problem. The overall score is the
            weighted average of the numbers you entered, so a missing number never counts as zero. Letters:{' '}
            {LETTER_THRESHOLDS.map((l) => `${l.letter} ${l.min}+`).join(', ')}, F below {LETTER_THRESHOLDS[LETTER_THRESHOLDS.length - 1]!.min}. With fewer
            than {MIN_METRICS_FOR_GRADE} numbers we don't give a grade.
          </p>

          <h3>{T.sourceTitle}</h3>
          <p>{METHOD_NOTE}</p>
        </div>
      </div>
    </div>
  );
}
