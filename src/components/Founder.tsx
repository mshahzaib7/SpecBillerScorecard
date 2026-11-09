import { isPlaceholder } from '../engine';
import { FOUNDER } from '../content/closing';
import { FOUNDER_INITIALS, FOUNDER_PHOTO } from '../content/copy';
import { BookingButton } from './BookingButton';
import { FadeUp } from './FadeUp';

/** Founder (DESIGN-BRIEF 7.12). The real portrait goes in FOUNDER_PHOTO; initials show until then. */
export function Founder() {
  return (
    <section className="section founder2" aria-labelledby="founder-name">
      <FadeUp className="container founder2__grid">
        {isPlaceholder(FOUNDER_PHOTO) ? (
          <div className="founder2__photo founder2__photo--initials" aria-hidden="true">
            {FOUNDER_INITIALS}
          </div>
        ) : (
          <img className="founder2__photo" src={FOUNDER_PHOTO} alt={`Portrait of ${FOUNDER.name}`} width={280} height={280} loading="lazy" />
        )}
        <figure className="founder2__body">
          <blockquote className="founder2__quote">
            <p>{FOUNDER.quote}</p>
          </blockquote>
          <figcaption className="founder2__sig">
            <span className="founder2__name" id="founder-name">
              {FOUNDER.name}
            </span>
            <span className="founder2__line">{FOUNDER.line}</span>
          </figcaption>
          <div id="cta-final" className="founder2__cta">
            <BookingButton />
          </div>
        </figure>
      </FadeUp>
    </section>
  );
}
