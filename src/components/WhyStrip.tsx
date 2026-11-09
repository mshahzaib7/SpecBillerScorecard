import { WHY_NUMBERS } from '../content/copy';

/** "Why these numbers" strip (DESIGN-BRIEF 7.3): three honest facts, no invented statistics. */
export function WhyStrip() {
  return (
    <section className="facts" aria-label="About this scorecard">
      <div className="container">
        <ul className="facts__grid">
          {WHY_NUMBERS.map((w) => (
            <li key={w.figure} className="facts__item">
              <span className="facts__figure">{w.figure}</span>
              <p className="facts__text">{w.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
