import { METRICS, type MetricId, type ScorecardResult } from '../engine';
import {
  BIGGEST_OPPORTUNITY,
  METRIC_IN_SENTENCE,
  NO_GRADE_VERDICT,
  SEE_STATEMENT,
  VERDICT_A_NOTE,
  VERDICT_MONEY_NOTE,
  VERDICT_TOP_LEVEL,
  VERDICT_TOP_LEVEL_NOTE,
  VERDICTS,
} from '../content/copy';
import { LEDGER_COPY } from '../content/copy';
import { MONEY_NO_DATA_TEXT, MONEY_TOP_LEVEL_TEXT } from '../content/sections';
import { moneyFigure, UNIT_SUFFIX } from '../lib/money';
import { IconArrowRight } from './Icons';

/** "12%" / "92.5%" / "57 days": one decimal, dropped when it is .0. */
function short(value: number, id: MetricId): string {
  const v = Number.isInteger(Math.round(value * 10) / 10) ? String(Math.round(value)) : (Math.round(value * 10) / 10).toFixed(1);
  return METRICS[id].unit === '%' ? `${v}%` : `${v} days`;
}

interface Props {
  result: ScorecardResult;
  offerLabel: string;
  onPrimary: () => void;
  onStatement: () => void;
}

/**
 * Verdict band (DESIGN-BRIEF 7.6): the first thing on the results. Grade, verdict, the visitor's
 * money line and the primary action together, inside the first screen of a 390 x 700 phone.
 */
export function VerdictBand({ result, offerLabel, onPrimary, onStatement }: Props) {
  const { letter, score } = result.overall;
  const card = result.headlineCard;
  const isA = letter === 'A';
  const opp = result.biggestOpportunity;
  const oppValue = opp ? result.metrics[opp].displayValue : null;
  const anyMoneyMetric = (['ncr', 'dar', 'den', 'ar90'] as const).some((id) => result.metrics[id].availability === 'graded');
  // No money gaps at all (and a grade): a top-level practice gets its own verdict.
  const topLevel = !!letter && !card && anyMoneyMetric;

  return (
    <section className="verdict on-dark" id="results" aria-labelledby="verdict-title" tabIndex={-1}>
      <div className="container verdict__grid">
        <div className="verdict__grade">
          <p className={`verdict__letter ${letter ? '' : 'verdict__letter--none'}`} aria-hidden="true">
            {letter ?? 'No grade'}
          </p>
          <p className="verdict__score">{score !== null ? `${score.toFixed(1)} / 100` : 'Too few graded numbers'}</p>
        </div>

        <div className="verdict__body">
          <h2 className="verdict__title" id="verdict-title">
            <span className="sr-only">{letter ? `Your grade: ${letter}, ${score?.toFixed(1)} out of 100. ` : 'No letter grade yet. '}</span>
            {topLevel ? VERDICT_TOP_LEVEL : letter ? VERDICTS[letter] : NO_GRADE_VERDICT}
          </h2>

          {card ? (
            <div className="verdict__money">
              {isA && <p className="verdict__tag">{LEDGER_COPY.roomToGrow}</p>}
              <p className="verdict__figure">
                <span className="verdict__amount">{moneyFigure(card.vsTop)}</span> <span className="verdict__unit">{UNIT_SUFFIX[card.timeUnit]}</span>
              </p>
              <p className="verdict__note">{isA ? VERDICT_A_NOTE : VERDICT_MONEY_NOTE[card.id]}</p>
            </div>
          ) : (
            <p className="verdict__note verdict__note--solo">{topLevel ? VERDICT_TOP_LEVEL_NOTE : anyMoneyMetric ? MONEY_TOP_LEVEL_TEXT : MONEY_NO_DATA_TEXT}</p>
          )}

          {opp && oppValue !== null && (
            <p className="verdict__opp">
              {BIGGEST_OPPORTUNITY}: {METRIC_IN_SENTENCE[opp]}, {short(oppValue, opp)} vs. {short(METRICS[opp].topTarget, opp)} at top practices.
            </p>
          )}

          <div className="verdict__actions">
            <button type="button" className="btn btn--primary" onClick={onPrimary}>
              {offerLabel}
              <IconArrowRight size={20} />
            </button>
            <button type="button" className="verdict__link" onClick={onStatement}>
              {SEE_STATEMENT}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
