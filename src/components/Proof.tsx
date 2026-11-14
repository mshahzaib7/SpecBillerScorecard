import { PROOF } from '../content/copy';

/** What practice owners told us: the real email screenshots, redacted in the image files. */
export function Proof() {
  return (
    <section className="proof" aria-labelledby="proof-title">
      <div className="container">
        <h2 id="proof-title" className="h2 proof__title">{PROOF.title}</h2>
        <p className="proof__sub">{PROOF.sub}</p>
        <ul className="proof__list">
          {PROOF.items.map((t) => (
            <li key={t.src} className="proof__item">
              <figure className="proof__fig">
                <div className="proof__shot">
                  <img src={t.src} width={t.w} height={t.h} alt={t.alt} loading="lazy" decoding="async" />
                </div>
                <figcaption className="proof__quote">“{t.quote}”</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
