import { useReducedMotion } from 'framer-motion';
import { Anim, Presence } from '../lib/motion';
import { useState } from 'react';
import { isPlaceholder } from '../engine';
import { FAQ, FAQ_TITLE } from '../content/closing';
import { FadeUp } from './FadeUp';
import { IconChevronDown } from './Icons';

/** Questions owners ask (DESIGN-BRIEF 7.11). Answers that are off or still placeholders are hidden. */
export function Faq() {
  const reduce = useReducedMotion();
  const items = FAQ.filter((f) => f.on && !isPlaceholder(f.a));
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title">
      <div className="container faq__grid">
        <FadeUp>
          <h2 className="h2" id="faq-title">
            {FAQ_TITLE}
          </h2>
        </FadeUp>
        <ul className="faq__list">
          {items.map((f, i) => {
            const isOpen = open === i;
            const pid = `faq-${i}`;
            return (
              <li key={f.q} className={`faq__item ${isOpen ? 'faq__item--open' : ''}`}>
                <h3>
                  <button type="button" className="faq__q" aria-expanded={isOpen} aria-controls={pid} onClick={() => setOpen(isOpen ? null : i)}>
                    {f.q}
                    <IconChevronDown size={20} className="faq__chev" />
                  </button>
                </h3>
                <Presence initial={false}>
                  {isOpen && (
                    <Anim
                      id={pid}
                      className="faq__a"
                      motion={{
                        // Reduced motion: fades open, no sliding.
                        initial: reduce ? { opacity: 0 } : { height: 0, opacity: 0 },
                        animate: { height: 'auto', opacity: 1 },
                        exit: reduce ? { opacity: 0 } : { height: 0, opacity: 0 },
                        transition: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] },
                      }}
                    >
                      <p>{f.a}</p>
                    </Anim>
                  )}
                </Presence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
