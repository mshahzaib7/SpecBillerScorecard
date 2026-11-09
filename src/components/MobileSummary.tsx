import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import type { Summary } from './TopBar';
import { IconArrowRight } from './Icons';

/** Phones (DESIGN-BRIEF 8): after the verdict band scrolls away, a bottom bar with the jade gap and the primary button. */
export function MobileSummary({ summary }: { summary: Summary }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {summary.visible && (
        <m.div
          className="msum"
          initial={reduce ? false : { y: '110%' }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0 } : { y: '110%' }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {summary.figure && (
            <span className="msum__gap">
              <strong>{summary.figure}</strong>
              <span>{summary.unit}</span>
            </span>
          )}
          <button type="button" className="btn btn--primary msum__btn" onClick={summary.onClick}>
            {summary.label}
            <IconArrowRight size={18} />
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
