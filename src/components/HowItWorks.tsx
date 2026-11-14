import { HOW_IT_WORKS } from '../content/copy';

/** How it works: three steps and the start button. */
export function HowItWorks({ onStart }: { onStart: () => void }) {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="container">
        <h2 id="how-title" className="h2 how__title">{HOW_IT_WORKS.title}</h2>
        <ol className="how__grid">
          {HOW_IT_WORKS.steps.map((s, i) => (
            <li key={s.title} className="how__item">
              <span className="how__num" aria-hidden="true">{i + 1}</span>
              <h3 className="how__step">{s.title}</h3>
              <p className="how__text">{s.text}</p>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--primary how__start" onClick={onStart}>
          {HOW_IT_WORKS.button}
        </button>
      </div>
    </section>
  );
}
