import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';

export interface Summary {
  visible: boolean;
  letter: string | null;
  score: number | null;
  figure: string | null;
  unit: string;
  label: string;
  onClick: () => void;
}

interface Props {
  /** Before results only: the small jade "Get my scorecard" button. */
  showStart: boolean;
  onStart: () => void;
  onMethod: () => void;
  /** After the reveal: grade, the jade gap and the primary button once the verdict band has scrolled away. */
  summary?: Summary | null;
}

/** Transparent over the hero; paper white with a hairline after 40px of scroll (DESIGN-BRIEF 7.1). */
export function TopBar({ showStart, onStart, onMethod, summary }: Props) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // While the questions are on screen, their own Next button is the one primary action.
  const [inQuestions, setInQuestions] = useState(false);
  useEffect(() => {
    const el = document.getElementById('form');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // threshold 0 + margin (not a share of the element): works however tall the section is.
    const io = new IntersectionObserver(([e]) => setInQuestions(!!e?.isIntersecting), { threshold: 0, rootMargin: '0px 0px -15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`topbar ${scrolled ? 'topbar--solid' : 'topbar--clear on-dark'}`}>
      <div className="container topbar__inner">
        <Wordmark as="a" tone={scrolled ? 'light' : 'dark'} />
        {summary?.visible && (
          <div className="topbar__summary">
            {summary.letter && (
              <span className="topbar__grade">
                <strong>{summary.letter}</strong> <span className="mono">{summary.score?.toFixed(1)} / 100</span>
              </span>
            )}
            {summary.figure && (
              <span className="topbar__gap">
                {summary.figure} <span>{summary.unit}</span>
              </span>
            )}
            <button type="button" className="btn btn--primary btn--small" onClick={summary.onClick}>
              {summary.label}
            </button>
          </div>
        )}
        <nav className={`topbar__nav ${summary?.visible ? 'topbar__nav--hide-wide' : ''}`} aria-label="Page">
          <button type="button" className="topbar__link" onClick={onMethod}>
            How we calculate
          </button>
          {showStart && !inQuestions && (
            <button type="button" className="btn btn--primary btn--small topbar__start" onClick={onStart}>
              Get my scorecard
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
