import { AnimatePresence, m as mo, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import {
  METRIC_ORDER,
  METRICS,
  STATUS_THRESHOLDS,
  type MetricId,
  type MetricResult,
  type ScorecardResult,
  type Specialty,
} from '../engine';
import { METRIC_EXPLAINERS, NOT_REPORTED_NOTE, NOT_REPORTED_TEXT, PI_RULE_TEXT, SPECIALTY_LABEL, STATEMENT_COPY, type ByIssueBullets } from '../content/copy';
import { formatMetric, formatTarget, preparedDate } from '../lib/format';
import { FadeUp } from './FadeUp';
import { IconChevronDown } from './Icons';

/**
 * The track is measured in SCORE (better is always to the right), so the zones line up with the
 * statuses: Problem < 60 ≤ Watch < 85 ≤ Good. Score 85 is the Good target, 100 the Top target.
 */
const ZONE_EDGE = { watch: 45, good: 72 } as const; // % of track width
export function trackPosition(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  const { watch, good } = STATUS_THRESHOLDS;
  if (s < watch) return (s / watch) * ZONE_EDGE.watch;
  if (s < good) return ZONE_EDGE.watch + ((s - watch) / (good - watch)) * (ZONE_EDGE.good - ZONE_EDGE.watch);
  return ZONE_EDGE.good + ((s - good) / (100 - good)) * (100 - ZONE_EDGE.good);
}

const STATUS_WORD = { good: 'Good', watch: 'Watch', problem: 'Problem' } as const;

/** Specialty-specific line first (DESIGN-BRIEF 7.7), then the shared lines. */
function specialtyFirst(issue: ByIssueBullets, specialty: Specialty | null): string[] {
  const extra = issue.specialty[specialty ?? 'other'];
  return extra ? [extra, ...issue.shared] : issue.shared;
}

function Track({ metric }: { metric: MetricResult }) {
  const reduce = useReducedMotion();
  if (metric.score === null) return null;
  const pos = trackPosition(metric.score);
  return (
    <span className="strack" aria-hidden="true">
      <span className="strack__bar">
        <span className="strack__zone strack__zone--problem" style={{ width: `${ZONE_EDGE.watch}%` }} />
        <span className="strack__zone strack__zone--watch" style={{ width: `${ZONE_EDGE.good - ZONE_EDGE.watch}%` }} />
        <span className="strack__zone strack__zone--good" style={{ width: `${100 - ZONE_EDGE.good}%` }} />
        <span className="strack__tick" style={{ left: `${ZONE_EDGE.good}%` }} />
        <span className="strack__tick strack__tick--top" style={{ left: '100%' }} />
        <mo.span
          className="strack__marker"
          style={{ left: `${pos}%` }}
          initial={reduce ? false : { opacity: 0, scale: 0.4 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </span>
      {/* Labels sit below the bar; the marker sits on the bar, so they never collide. */}
      <span className="strack__labels">
        <span style={{ width: `${ZONE_EDGE.watch}%` }}>Problem</span>
        <span style={{ width: `${ZONE_EDGE.good - ZONE_EDGE.watch}%` }}>Watch</span>
        <span className="strack__goodlabel" style={{ width: `${100 - ZONE_EDGE.good}%` }}>
          <span>Good</span>
          <span>Top</span>
        </span>
      </span>
    </span>
  );
}

function StatusCell({ metric, biggest }: { metric: MetricResult; biggest: boolean }) {
  return (
    <span className="srow__status">
      {metric.availability === 'unavailable' && <span className="srow__muted">{STATEMENT_COPY.notReported}</span>}
      {metric.availability === 'notGraded' && <span className="srow__muted">{STATEMENT_COPY.notGraded}</span>}
      {metric.status && (
        <span className={`sdot sdot--${metric.status}`}>
          <i aria-hidden="true" />
          {STATUS_WORD[metric.status]}
        </span>
      )}
      {metric.topPerformer && <span className="mark">{STATEMENT_COPY.topMark}</span>}
      {biggest && <span className="mark">{STATEMENT_COPY.biggest}</span>}
    </span>
  );
}

interface Props {
  result: ScorecardResult;
  specialty: Specialty | null;
}

export function StatementTable({ result, specialty }: Props) {
  const reduce = useReducedMotion();
  const biggest = result.biggestOpportunity;
  const [open, setOpen] = useState<MetricId | null>(biggest);
  const today = preparedDate();
  const specialtyLabel = specialty ? SPECIALTY_LABEL[specialty] : undefined;
  const C = STATEMENT_COPY;

  return (
    <section className="section statement" id="statement" aria-labelledby="statement-title">
      <div className="container">
        <FadeUp className="statement__head">
          <h2 className="h2" id="statement-title">
            {C.title}
          </h2>
          <p className="statement__meta">
            Prepared {today}
            {specialtyLabel ? ` · ${specialtyLabel}` : ''}
          </p>
        </FadeUp>

        <div className="stable">
          <div className="stable__head" aria-hidden="true">
            <span>{C.cols.number}</span>
            <span className="stable__num">
              {C.cols.you}
            </span>
            <span className="stable__num">
              {C.cols.good}
            </span>
            <span className="stable__num">
              {C.cols.top}
            </span>
            <span>{C.cols.status}</span>
            <span aria-hidden="true" />
          </div>

          {METRIC_ORDER.map((id) => {
            const m = result.metrics[id];
            const cfg = METRICS[id];
            const isOpen = open === id;
            const valueText = m.displayValue === null ? null : formatMetric(m.displayValue, cfg.unit);
            const ex = METRIC_EXPLAINERS[id];
            const panelId = `srow-${id}`;
            return (
              <div key={id} className={`srow ${isOpen ? 'srow--open' : ''}`}>
                <button
                  type="button"
                  className="srow__main"
                 
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : id)}
                >
                  <span className="srow__name">
                    {cfg.shortName}
                  </span>
                  <span className="srow__you stable__num">
                    <span className="srow__k">{C.cols.you} </span>
                    {valueText ?? <span className="srow__muted">{C.notReported}</span>}
                  </span>
                  <span className="srow__good stable__num">
                    <span className="srow__k">{C.cols.good} </span>
                    {formatTarget(cfg.goodTarget, cfg.unit)}
                  </span>
                  <span className="srow__top stable__num">
                    <span className="srow__k">{C.cols.top} </span>
                    {formatTarget(cfg.topTarget, cfg.unit)}
                  </span>
                  <StatusCell metric={m} biggest={biggest === id} />
                  <span className="srow__chev" aria-hidden="true">
                    <IconChevronDown size={18} />
                  </span>
                  <span className="srow__track">
                    {m.availability === 'graded' && <Track metric={m} />}
                    {/* Not reported: the note shows in the row itself, without expanding it. */}
                    {m.availability === 'unavailable' && <span className="srow__note">{NOT_REPORTED_NOTE}</span>}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <mo.div
                      id={panelId}
                      className="srow__panel"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <div className="srow__cols">
                        {m.availability === 'unavailable' ? (
                          <div className="srow__col">
                            <h3>{C.means}</h3>
                            <p>{NOT_REPORTED_TEXT}</p>
                          </div>
                        ) : (
                          <div className="srow__col">
                            <h3>{C.means}</h3>
                            {m.availability === 'notGraded' && <p>{PI_RULE_TEXT}</p>}
                            {valueText && ex.means(valueText).map((b) => <p key={b}>{b}</p>)}
                          </div>
                        )}
                        <div className="srow__col">
                          <h3>{C.why}</h3>
                          <ul>
                            {specialtyFirst(ex.causes, specialty).map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="srow__col">
                          <h3>{C.fix}</h3>
                          <ul>
                            {specialtyFirst(ex.fixes, specialty).map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </mo.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
