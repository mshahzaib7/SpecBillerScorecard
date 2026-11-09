import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { MONEY_MIN_DISPLAY, type MoneyCard, type ScorecardInputs, type ScorecardResult } from '../engine';
import { LEDGER_COPY } from '../content/copy';
import { MONEY_COPY, MONEY_NO_DATA_TEXT, MONEY_TOP_LEVEL_TEXT, TIME_UNIT_LABEL } from '../content/sections';
import { formatMoney } from '../lib/format';
import { useTweened } from '../lib/tween';
import { formulaFor, moneyFigure } from '../lib/money';
import { FadeUp } from './FadeUp';
import { IconChevronDown } from './Icons';

type Level = 'top' | 'good';

/** A figure that counts to its new value when the compare level changes (400ms). */
function CountedMoney({ card, level }: { card: MoneyCard; level: Level }) {
  const line = level === 'top' ? card.vsTop : card.vsGood;
  const target = line && !line.belowMinimum ? line.rounded : 0;
  const shown = useTweened(target, 0.4);
  if (!line) return <span className="ledger__figure ledger__figure--none">{LEDGER_COPY.atGood}</span>;
  if (line.belowMinimum) return <span className="ledger__figure">{`Under ${formatMoney(MONEY_MIN_DISPLAY)}`}</span>;
  return <span className="ledger__figure">{formatMoney(Math.round(shown / 100) * 100)}</span>;
}

function LedgerRow({ card, level, result, inputs, onMethod }: { card: MoneyCard; level: Level; result: ScorecardResult; inputs: ScorecardInputs; onMethod: () => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const copy = MONEY_COPY[card.id];
  const f = formulaFor(card, result, inputs, level);
  const panelId = `ledger-${card.id}`;
  return (
    <li className="ledger__row">
      <div className="ledger__main">
        <div className="ledger__label">
          <span className="ledger__name">{copy.name}</span>
          <span className="ledger__unit">
            {TIME_UNIT_LABEL[card.timeUnit]}
            {card.kind === 'roomToGrow' ? ` · ${LEDGER_COPY.roomToGrow}` : ''}
          </span>
        </div>
        <CountedMoney card={card} level={level} />
      </div>
      {card.headline && (
        <p className="ledger__sub">
          {moneyFigure(card.headline)} {copy.headlineSuffix}
        </p>
      )}
      <button type="button" className="ledger__how" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {LEDGER_COPY.howWeGotThis}
        <IconChevronDown size={16} className={open ? 'ledger__chev ledger__chev--open' : 'ledger__chev'} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            className="ledger__calc"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="ledger__calc-inner">
              <p>{f.rule}</p>
              {f.extra && <p className="mono">{f.extra}</p>}
              {f.line && <p className="mono">{f.line}</p>}
              <p className="ledger__fine">{LEDGER_COPY.rounding}</p>
              <button type="button" className="ledger__method" onClick={onMethod}>
                {LEDGER_COPY.allFormulas}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Where the money is (DESIGN-BRIEF 7.8): a ledger, not cards, with one compare switch. */
export function MoneyLedger({ result, inputs, onMethod }: { result: ScorecardResult; inputs: ScorecardInputs; onMethod: () => void }) {
  const [level, setLevel] = useState<Level>('top');
  const anyMoneyMetric = (['ncr', 'dar', 'den', 'ar90'] as const).some((id) => result.metrics[id].availability === 'graded');
  const cards = result.moneyCards;

  return (
    <section className="section ledger" id="money" aria-labelledby="money-title">
      <div className="container">
        <FadeUp className="ledger__head">
          <h2 className="h2" id="money-title">
            {LEDGER_COPY.title}
          </h2>
          {cards.length > 0 && (
            <div className="seg" role="radiogroup" aria-label={LEDGER_COPY.compareLabel}>
              <span className="seg__label" aria-hidden="true">
                {LEDGER_COPY.compareLabel}:
              </span>
              {(['top', 'good'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={level === l}
                  tabIndex={level === l ? 0 : -1}
                  className={`seg__opt ${level === l ? 'seg__opt--on' : ''}`}
                  onClick={() => setLevel(l)}
                  onKeyDown={(e) => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                    e.preventDefault();
                    const other = l === 'top' ? 'good' : 'top';
                    setLevel(other);
                    (e.currentTarget.parentElement?.querySelector(`[data-level="${other}"]`) as HTMLElement | null)?.focus();
                  }}
                  data-level={l}
                >
                  {l === 'top' ? LEDGER_COPY.top : LEDGER_COPY.good}
                </button>
              ))}
            </div>
          )}
        </FadeUp>

        {cards.length > 0 ? (
          <>
            <ul className="ledger__rows">
              {cards.map((c) => (
                <LedgerRow key={c.id} card={c} level={level} result={result} inputs={inputs} onMethod={onMethod} />
              ))}
            </ul>
            <p className="ledger__foot">{LEDGER_COPY.footnote}</p>
          </>
        ) : (
          <p className="ledger__empty">{anyMoneyMetric ? MONEY_TOP_LEVEL_TEXT : MONEY_NO_DATA_TEXT}</p>
        )}
      </div>
    </section>
  );
}
