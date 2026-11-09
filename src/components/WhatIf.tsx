import { useMemo, useRef, useState } from 'react';
import {
  applySliderChange,
  masterSliderOverrides,
  METRIC_ORDER,
  METRICS,
  roundMoney,
  simulateScorecard,
  sliderStartValues,
  type MetricId,
  type MetricOverrides,
  type ScorecardInputs,
  type ScorecardResult,
} from '../engine';
import { RATE_LINE, WHATIF_COPY } from '../content/copy';
import { formatMetric, formatMoney, formatTarget } from '../lib/format';
import { UNIT_SUFFIX } from '../lib/money';
import { FadeUp } from './FadeUp';
import { IconChevronDown } from './Icons';

/** Single-slider ranges (UI only, not benchmarks). Widened to include the visitor's own value. */
const RANGE: Record<MetricId, { min: number; max: number; step: number }> = {
  ncr: { min: 80, max: 100, step: 0.1 },
  dar: { min: 20, max: 90, step: 0.5 },
  ar90: { min: 0, max: 45, step: 0.5 },
  den: { min: 0, max: 25, step: 0.1 },
  fpr: { min: 70, max: 100, step: 0.1 },
};
const rangeFor = (id: MetricId, v: number) => {
  const r = RANGE[id];
  return { min: Math.min(r.min, Math.floor(v)), max: Math.max(r.max, Math.ceil(v)), step: r.step };
};

/** Within this many percent of a snap point, the master slider snaps to it. */
const SNAP = 2;

const better = (id: MetricId, a: number, b: number) => (METRICS[id].direction === 'higherIsBetter' ? a >= b : a <= b);

/**
 * The share (0 to 100) at which every graded metric has reached its Good target on the master
 * slider's path, or null when the visitor is already at Good everywhere.
 */
function goodShare(result: ScorecardResult): number | null {
  const start = sliderStartValues(result);
  const end = masterSliderOverrides(result, 1);
  let t = 0;
  for (const id of Object.keys(start) as MetricId[]) {
    const a = start[id]!;
    const b = end[id]!;
    const g = METRICS[id].goodTarget;
    if (better(id, a, g) || a === b) continue;
    t = Math.max(t, (g - a) / (b - a));
  }
  return t > 0 && t < 1 ? Math.ceil(t * 100) : null;
}

interface Props {
  result: ScorecardResult;
  inputs: ScorecardInputs;
}

/** What if (DESIGN-BRIEF 7.9): one master slider from today to top-practice levels. */
export function WhatIf({ result, inputs }: Props) {
  const start = useMemo(() => sliderStartValues(result), [result]);
  const ids = METRIC_ORDER.filter((id) => start[id] !== undefined);
  const snapGood = useMemo(() => goodShare(result), [result]);
  const [t, setT] = useState(0);
  const [custom, setCustom] = useState<MetricOverrides | null>(null);
  const [detail, setDetail] = useState(false);
  const lastSnap = useRef<number | null>(null);

  if (ids.length === 0) return null;

  const values = custom ?? masterSliderOverrides(result, t / 100);
  const sim = simulateScorecard(inputs, values);

  // The money line follows the visitor's headline figure (the yearly gap for most practices).
  const card = result.headlineCard;
  const simCard = card ? sim.moneyCards.find((c) => c.id === card.id) : undefined;
  const extra = card ? roundMoney(Math.max(0, card.vsTop.raw - (simCard?.vsTop.raw ?? 0))) : 0;

  const onMaster = (raw: number) => {
    let v = raw;
    const snaps = [100, ...(snapGood !== null ? [snapGood] : [])];
    const hit = snaps.find((s) => Math.abs(v - s) <= SNAP);
    if (hit !== undefined) {
      v = hit;
      if (lastSnap.current !== hit && typeof navigator !== 'undefined') navigator.vibrate?.(12);
      lastSnap.current = hit;
    } else {
      lastSnap.current = null;
    }
    setCustom(null);
    setT(v);
  };

  const onSingle = (id: MetricId, v: number) => setCustom(applySliderChange(values, id, v));

  const letter = sim.overall.letter;
  const score = sim.overall.score;
  const valueText =
    `${t}% of the way to top practices. ` + (letter ? `Grade ${letter}, ${score?.toFixed(1)} out of 100.` : 'No grade.');
  const labelAt = (pct: number) => (pct < 12 ? 'whatif__snap--start' : pct > 88 ? 'whatif__snap--end' : '');

  return (
    <section className="section whatif" id="simulator" aria-labelledby="whatif-title">
      <div className="container whatif__grid">
        <FadeUp className="whatif__head">
          <h2 className="h2" id="whatif-title">
            {WHATIF_COPY.title}
          </h2>
          <p className="lead">{WHATIF_COPY.lead}</p>
        </FadeUp>

        <div className="whatif__main">
          <div className="whatif__slider">
            <label htmlFor="whatif-master" className="sr-only">
              {WHATIF_COPY.sliderLabel}
            </label>
            {/* Snap labels sit above the track, the end labels below, so they never collide. */}
            <div className="whatif__snaps" aria-hidden="true">
              {snapGood !== null && (
                <span className={`whatif__snap ${labelAt(snapGood)}`} style={{ left: `${snapGood}%` }}>
                  {WHATIF_COPY.goodSnap}
                </span>
              )}
            </div>
            <input
              id="whatif-master"
              type="range"
              className="range range--master"
              min={0}
              max={100}
              step={1}
              value={t}
              aria-valuetext={valueText}
              style={{ '--pct': `${t}%` } as React.CSSProperties}
              onChange={(e) => onMaster(Number(e.target.value))}
            />
            <div className="whatif__scale" aria-hidden="true">
              <span className="whatif__end">{WHATIF_COPY.today}</span>
              <span className="whatif__end whatif__end--right">{WHATIF_COPY.top}</span>
            </div>
          </div>

          <ul className="whatif__values" aria-label="Your numbers at this point">
            {ids.map((id) => (
              <li key={id}>
                <span className="whatif__vname">{RATE_LINE[id]}</span>
                <span className="whatif__vval">{formatMetric(Math.round(values[id]! * 10) / 10, METRICS[id].unit)}</span>
              </li>
            ))}
          </ul>

          <button type="button" className="whatif__adjust" aria-expanded={detail} aria-controls="whatif-detail" onClick={() => setDetail((d) => !d)}>
            {detail ? WHATIF_COPY.hideAdjust : WHATIF_COPY.adjust}
            <IconChevronDown size={16} className={detail ? 'ledger__chev ledger__chev--open' : 'ledger__chev'} />
          </button>
          {detail && (
            <ul className="whatif__detail" id="whatif-detail">
              {ids.map((id) => {
                const cfg = METRICS[id];
                const v = values[id]!;
                const r = rangeFor(id, start[id]!);
                const pct = ((v - r.min) * 100) / (r.max - r.min);
                const label = formatMetric(Math.round(v * 10) / 10, cfg.unit);
                return (
                  <li key={id} className="whatif__single">
                    <div className="whatif__singlehead">
                      <label htmlFor={`wi-${id}`}>{cfg.shortName}</label>
                      <span className="mono">{label}</span>
                    </div>
                    <input
                      id={`wi-${id}`}
                      type="range"
                      className="range"
                      min={r.min}
                      max={r.max}
                      step={r.step}
                      value={v}
                      aria-valuetext={label}
                      style={{ '--pct': `${pct}%` } as React.CSSProperties}
                      onChange={(e) => onSingle(id, Number(e.target.value))}
                    />
                    <p className="whatif__targets">
                      Yours {formatMetric(start[id]!, cfg.unit)} · Good {formatTarget(cfg.goodTarget, cfg.unit)} · Top{' '}
                      {formatTarget(cfg.topTarget, cfg.unit)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="whatif__note">{WHATIF_COPY.note}</p>
        </div>

        <aside className="whatif__panel on-dark" aria-live="polite">
          <div className="whatif__grade">
            <span className="whatif__letter" key={letter ?? 'none'}>
              {letter ?? 'No grade'}
            </span>
            <span className="whatif__score">{score !== null ? `${score.toFixed(1)} / 100` : 'Too few graded numbers'}</span>
          </div>
          {card && (
            <div className="whatif__money">
              <span className="whatif__figure">
                +{formatMoney(extra)} <span className="whatif__unit">{UNIT_SUFFIX[card.timeUnit]}</span>
              </span>
              <span className="whatif__caption">{extra === 0 ? WHATIF_COPY.atStart : card.id === 'uncollected' ? WHATIF_COPY.extraCollected : WHATIF_COPY.extraOther}</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
