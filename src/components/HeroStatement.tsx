import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeScorecard,
  METRIC_ORDER,
  METRICS,
  roundMoney,
  simulateScorecard,
  sliderStartValues,
  targetSliderValues,
  type MetricId,
  type MetricOverrides,
  type Status,
} from '../engine';
import { formatMoney } from '../lib/format';
import { afterLoadIdle } from '../lib/idle';
import { EXAMPLE_INPUTS } from '../lib/formState';

/* One loop is 6 seconds: hold, rows improve one by one, hold at Good levels, glide back. */
const HOLD_START = 1.0;
const ROW_DUR = 0.7;
const STAGGER = 0.4;
const HOLD_UNTIL = 5.4;
const RESET = 0.6;
const LOOP = HOLD_UNTIL + RESET;
const TICK_RATE = 12;
const TICKS = Math.round(LOOP * TICK_RATE);

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Progress (0 = today, 1 = Good) of row `i` at time `s` in the loop. */
function rowProgress(i: number, s: number): number {
  if (s >= HOLD_UNTIL) return 1 - ease(clamp01((s - HOLD_UNTIL) / RESET));
  return ease(clamp01((s - HOLD_START - i * STAGGER) / ROW_DUR));
}

const STATUS_WORD: Record<Status, string> = { good: 'Good', watch: 'Watch', problem: 'Problem' };

function formatValue(id: MetricId, v: number): string {
  return METRICS[id].unit === 'days' ? `${Math.round(v)} days` : `${v.toFixed(1)}%`;
}

/**
 * Hero example statement (DESIGN-BRIEF 7.2), driven by the real engine with the example
 * practice (golden test 1). Rows move toward Good levels one by one, the grade climbs to B,
 * and the jade total counts down to the gap that remains. Pauses on hover, touch,
 * when off screen, or with the pause button.
 * Reduced motion (battery saver, accessibility settings): shows the first frame and a small
 * "Play demo" button instead of looping. One press plays one loop (numbers change, nothing slides).
 */
export function HeroStatement() {
  const reduce = useReducedMotion();
  const base = useMemo(() => computeScorecard(EXAMPLE_INPUTS), []);
  const start = useMemo(() => sliderStartValues(base), [base]);
  const good = useMemo(() => targetSliderValues(base, 'good'), [base]);

  /* The loop advances in ticks of 1/12 s (smooth enough for counting figures) and each tick's
     scorecard is cached, so after the first loop the demo does no math at all. It starts only once
     the browser is idle after load, so it never competes with the first paint or first input. */
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [touchHold, setTouchHold] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // Reduced motion: the demo plays only when asked, once.
  const [demoPlaying, setDemoPlaying] = useState(false);
  // Paused until the hero is confirmed visible (and the page is idle, below).
  const [onScreen, setOnScreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const touchTimer = useRef<number>();
  const cache = useRef(new Map<number, { gap: number; score: number; letter: string; rows: { id: MetricId; value: number | null; status: Status | null }[] }>());
  const paused = (reduce ? !demoPlaying : !ready || hover || touchHold || userPaused) || !onScreen;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // threshold 0 + a small margin: fires on every screen size, even when the sheet is taller than the screen.
    const io = new IntersectionObserver(([e]) => setOnScreen(!!e?.isIntersecting), { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Start once the page is loaded and idle, or after 2.5 s at the latest (Safari has no requestIdleCallback).
  useEffect(() => afterLoadIdle(() => setReady(true), 2500), []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () =>
        setTick((t) => {
          const next = (t + 1) % TICKS;
          // Reduced motion: one loop, then stop on the first frame.
          if (reduce && next === 0) setDemoPlaying(false);
          return next;
        }),
      1000 / TICK_RATE,
    );
    return () => window.clearInterval(id);
  }, [paused, reduce]);

  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  const frameAt = (t: number) => {
    const hit = cache.current.get(t);
    if (hit) return hit;
    const s = t / TICK_RATE;
    const overrides: MetricOverrides = {};
    METRIC_ORDER.forEach((id, i) => {
      const a = start[id];
      const b = good[id];
      if (a === undefined || b === undefined) return;
      const p = rowProgress(i, s);
      overrides[id] = p <= 0 ? a : p >= 1 ? b : a + (b - a) * p;
    });
    const sim = simulateScorecard(EXAMPLE_INPUTS, overrides);
    const frame = {
      gap: roundMoney(sim.moneyCards.find((c) => c.id === 'uncollected')?.vsTop.raw ?? 0),
      score: sim.overall.score ?? 0,
      letter: sim.overall.letter ?? '',
      rows: METRIC_ORDER.map((id) => ({ id, value: sim.metrics[id].value, status: sim.metrics[id].status })),
    };
    cache.current.set(t, frame);
    return frame;
  };
  const frame = frameAt(tick);
  const { gap, score, letter } = frame;

  const startGap = roundMoney(base.moneyCards.find((c) => c.id === 'uncollected')?.vsTop.raw ?? 0);
  const summary =
    `Example practice with sample numbers. Grade ${base.overall.letter}, ${base.overall.score?.toFixed(1)} out of 100. ` +
    METRIC_ORDER.map((id) => `${METRICS[id].shortName} ${formatValue(id, base.metrics[id].value!)}, ${STATUS_WORD[base.metrics[id].status!]}`).join('. ') +
    `. Yearly gap versus top practices ${formatMoney(startGap)}.`;

  return (
    <div
      ref={ref}
      className="sheetwrap"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        window.clearTimeout(touchTimer.current);
        setTouchHold(true);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        touchTimer.current = window.setTimeout(() => setTouchHold(false), 2500);
      }}
    >
      <p className="sr-only">{summary}</p>
      <div className="sheet">
        <div className="sheet__head">
          <div>
            <p className="sheet__title" aria-hidden="true">Example practice</p>
            <p className="sheet__meta">
              <span aria-hidden="true">Sample numbers</span>
              {reduce ? (
                <button
                  type="button"
                  className="sheet__pause"
                  onClick={() => {
                    setTick(0);
                    setDemoPlaying((p) => !p);
                  }}
                  aria-label={demoPlaying ? 'Stop the example' : 'Play the example once'}
                >
                  {demoPlaying ? 'Stop' : 'Play demo'}
                </button>
              ) : (
                <button
                  type="button"
                  className="sheet__pause"
                  onClick={() => setUserPaused((p) => !p)}
                  aria-label={userPaused ? 'Play the example' : 'Pause the example'}
                >
                  {userPaused ? 'Play' : 'Pause'}
                </button>
              )}
            </p>
          </div>
          <div className="sheet__grade" aria-hidden="true">
            <span className="sheet__letter" key={letter}>
              {letter}
            </span>
            <span className="sheet__score">{score.toFixed(1)} / 100</span>
          </div>
        </div>
        <ul className="sheet__rows" aria-hidden="true">
          {frame.rows.map((m) => {
            const id = m.id;
            return (
              <li key={id} className="sheet__row">
                <span className="sheet__name">{METRICS[id].shortName}</span>
                <span className="sheet__value">{m.value === null ? '' : formatValue(id, m.value)}</span>
                {m.status && (
                  <span className={`sdot sdot--${m.status}`}>
                    <i aria-hidden="true" />
                    {STATUS_WORD[m.status]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sheet__total" aria-hidden="true">
        <span className="sheet__total-label">Yearly gap vs. top practices</span>
        <span className="sheet__total-figure">{formatMoney(gap)}</span>
      </div>
    </div>
  );
}
