import { useEffect, useRef, useState } from 'react';
import { QUESTION_CARDS } from '../engine/config';
import { QUESTIONS_ROW } from '../content/copy';

const SPEED = 40; // px per second

function Card({ c, onStart, copy }: { c: (typeof QUESTION_CARDS)[number]; onStart: () => void; copy: boolean }) {
  return (
    <li className="qrow__item" aria-hidden={copy || undefined}>
      <button type="button" className="qcard" onClick={onStart} tabIndex={copy ? -1 : undefined}>
        <span className="qcard__cat">{c.category}</span>
        <span className="qcard__q">{c.question}</span>
        {c.scorecard ? (
          <span className="qcard__chip">{QUESTIONS_ROW.chip}</span>
        ) : (
          <span className="qcard__cta">
            {QUESTIONS_ROW.cta}
            <svg className="qcard__arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * "Can you answer these?" row. Without JavaScript or with reduced motion it is a row the
 * visitor scrolls by hand (scroll snapping). With motion allowed, JavaScript adds `qrow--auto`
 * and a CSS transform animation moves it; hover, focus, touch and the Pause control stop it.
 */
export function QuestionsRow({ onStart }: { onStart: () => void }) {
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const trackRef = useRef<HTMLUListElement>(null);
  const releaseRef = useRef<number>();

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAuto(!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // One loop is half the track (the list is duplicated); its duration keeps the speed at 40px/s.
  useEffect(() => {
    if (!auto) return;
    const set = () => {
      const t = trackRef.current;
      if (t && t.scrollWidth > 0) t.style.setProperty('--qrow-dur', `${Math.round(t.scrollWidth / 2 / SPEED)}s`);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [auto]);

  useEffect(() => () => window.clearTimeout(releaseRef.current), []);

  const hold = () => {
    window.clearTimeout(releaseRef.current);
    setHeld(true);
  };
  const release = () => {
    window.clearTimeout(releaseRef.current);
    releaseRef.current = window.setTimeout(() => setHeld(false), 3000);
  };

  const cls = ['qrow', auto && 'qrow--auto', (paused || held) && 'qrow--paused'].filter(Boolean).join(' ');

  return (
    <section className={cls} aria-labelledby="qrow-title">
      <div className="qrow__band">
        <div className="container">
          <h2 id="qrow-title" className="h2 qrow__title">
            {QUESTIONS_ROW.titleStart}
            <span className="qrow__accent">{QUESTIONS_ROW.titleAccent}</span>
            {QUESTIONS_ROW.titleEnd}
          </h2>
          <p className="qrow__sub">{QUESTIONS_ROW.subtitle}</p>
        </div>
        <div
          className="qrow__viewport"
          onTouchStart={auto ? hold : undefined}
          onTouchEnd={auto ? release : undefined}
          onTouchCancel={auto ? release : undefined}
        >
          <ul className="qrow__track" ref={trackRef}>
            {QUESTION_CARDS.map((c, i) => (
              <Card key={i} c={c} onStart={onStart} copy={false} />
            ))}
            {auto && QUESTION_CARDS.map((c, i) => <Card key={`d${i}`} c={c} onStart={onStart} copy />)}
          </ul>
        </div>
        {auto && (
          <div className="container qrow__controls">
            <button type="button" className="qrow__pause" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? 'Play' : 'Pause'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
