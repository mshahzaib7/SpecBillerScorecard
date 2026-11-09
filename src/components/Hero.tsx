import { FOUNDER_INITIALS, FOUNDER_PHOTO, HERO } from '../content/copy';
import { isPlaceholder } from '../engine';
import { HeroStatement } from './HeroStatement';
import { IconArrowRight } from './Icons';

/* On short screens only the first sentence of the lead shows; the second is hidden by CSS. */
const LEAD_CUT = HERO.lead.indexOf('. ') + 1;
const LEAD_FIRST = HERO.lead.slice(0, LEAD_CUT);
const LEAD_MORE = HERO.lead.slice(LEAD_CUT + 1);

/**
 * Hero (DESIGN-BRIEF 7.2): the headline, what the visitor will learn, one button into the questions,
 * and the live example statement. The specialty is asked once, as the first question of the flow.
 */
export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <header className="hero on-dark" id="top">
      <div className="container hero__grid">
        <div className="hero__text">
          <h1 className="hero__title">
            <span className="hero__l1">{HERO.line1}</span> <span className="hero__l2">{HERO.line2}</span>
          </h1>
          <p className="hero__lead">
            {LEAD_FIRST} <span className="hero__lead-more">{LEAD_MORE}</span>
          </p>

          <div className="hero__know">
            <h2 className="hero__knowtitle">{HERO.knowHeading}</h2>
            <ul className="hero__knowlist">
              {HERO.knowItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <button type="button" className="btn btn--primary hero__start" onClick={onStart}>
            {HERO.start}
            <IconArrowRight size={20} />
          </button>
          <p className="hero__privacy">{HERO.privacy}</p>
        </div>

        <div className="hero__sheet">
          <HeroStatement />
        </div>

        <p className="hero__founder">
          {isPlaceholder(FOUNDER_PHOTO) ? (
            <span className="avatar avatar--initials" aria-hidden="true">
              {FOUNDER_INITIALS}
            </span>
          ) : (
            <img className="avatar" src={FOUNDER_PHOTO} alt="" width={40} height={40} />
          )}
          <span>{HERO.founderLine}</span>
        </p>
      </div>
    </header>
  );
}
