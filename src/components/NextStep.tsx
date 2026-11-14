import { useState } from 'react';
import {
  OFFER_CONFIG,
  offerCopy,
  PAIN_POINTS,
  REFERRAL_BLOCK,
  SWITCH_BLOCK,
  type OfferId,
  type PainPointId,
  type ScorecardInputs,
  type ScorecardResult,
  type Specialty,
} from '../engine';
import { CALL_STEPS, CLOSING_COPY, OFFER_FIGURE_LABEL } from '../content/closing';
import { CTA_HEADLINE } from '../content/sections';
import { openLeadFlow } from '../lib/hooks';
import { moneyFigure, UNIT_SUFFIX } from '../lib/money';
import { BOOKING_LABEL } from './BookingButton';
import { FadeUp } from './FadeUp';
import { IconArrowRight, IconShare } from './Icons';
import { LeadFlow } from './LeadFlow';

/** The visitor's own figure for the offer's jade block (DESIGN-BRIEF 7.10, conversion rule 4). */
function offerFigure(offer: OfferId | null, result: ScorecardResult): { label: string; amount: string; unit: string } | null {
  const head = result.headlineCard;
  if (offer === 'recoverySprint') {
    const c = result.moneyCards.find((m) => m.id === 'stuckOver90');
    if (c?.headline) return { label: OFFER_FIGURE_LABEL.stuck, amount: moneyFigure(c.headline), unit: '' };
  }
  if (offer === 'gapToTop') {
    const yearly = result.moneyCards.find((m) => m.timeUnit === 'perYear');
    if (yearly) return { label: OFFER_FIGURE_LABEL.yearly, amount: moneyFigure(yearly.vsTop), unit: UNIT_SUFFIX.perYear };
  }
  if (!head) return null;
  return {
    label: offer === 'keepItTop' ? OFFER_FIGURE_LABEL.room : OFFER_FIGURE_LABEL.gap,
    amount: moneyFigure(head.vsTop),
    unit: UNIT_SUFFIX[head.timeUnit],
  };
}

function ShareRow() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    // Plain site URL only, never the visitor's numbers.
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, text: REFERRAL_BLOCK.text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* share sheet dismissed, or clipboard blocked: nothing to do */
    }
  };
  return (
    <div className="next__share">
      <p>{REFERRAL_BLOCK.text}</p>
      <button type="button" className="btn btn--ghost-dark btn--small" onClick={share}>
        <IconShare size={18} />
        {copied ? REFERRAL_BLOCK.copied : REFERRAL_BLOCK.button}
      </button>
    </div>
  );
}

interface Props {
  result: ScorecardResult;
  inputs: ScorecardInputs;
  offer: OfferId | null;
  specialty: Specialty | null;
  painPoints: readonly PainPointId[];
}

/** The next step (DESIGN-BRIEF 7.10): the offer on sapphire, the lead flow on paper. */
export function NextStep({ result, inputs, offer, specialty, painPoints }: Props) {
  const copy = offer ? offerCopy(offer) : null;
  const figure = offerFigure(offer, result);
  const showSwitch = OFFER_CONFIG.switchSupportEnabled && offer !== 'keepItTop';
  // Up to 3 of the pains the visitor picked, each with how we handle it (from config.ts).
  const told = PAIN_POINTS.filter((p) => painPoints.includes(p.id)).slice(0, 3);

  return (
    <section className="next on-dark" id="cta" aria-labelledby="next-title">
      <div className="container next__grid">
        <FadeUp className="next__offer">
          <p className="next__rec">{CLOSING_COPY.recommended}</p>
          <h2 className="next__headline" id="next-title">
            {copy ? copy.headline : CTA_HEADLINE.none}
          </h2>
          {copy && <p className="next__body">{copy.body}</p>}
          {figure && (
            <p className="next__figure">
              <span className="next__figlabel">{figure.label}</span>
              <span className="next__amount">
                {figure.amount}
                {figure.unit && <span className="next__unit"> {figure.unit}</span>}
              </span>
            </p>
          )}
          {told.length > 0 && (
            <div className="next__told">
              <h3 className="next__minor">{CLOSING_COPY.toldUs}</h3>
              <ul>
                {told.map((p) => (
                  <li key={p.id}>
                    <span className="next__pain">{p.label}</span>
                    <span className="next__how">{p.howWeHandle}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" id="offer-cta" className="btn btn--primary next__btn" onClick={openLeadFlow}>
            {copy ? copy.button : BOOKING_LABEL}
            <IconArrowRight size={20} />
          </button>
          <div className="next__call">
            <h3 className="next__minor">{CLOSING_COPY.callTitle}</h3>
            <ol>
              {CALL_STEPS.map((step, i) => (
                <li key={step}>
                  <span className="next__step" aria-hidden="true">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          {showSwitch && <p className="next__switch">{SWITCH_BLOCK.text}</p>}
          {offer === 'keepItTop' && OFFER_CONFIG.referralEnabled && <ShareRow />}
        </FadeUp>

        <div className="next__form">
          <LeadFlow result={result} inputs={inputs} context={{ specialty, grade: result.overall.letter, offer, painPoints }} />
        </div>
      </div>
    </section>
  );
}
