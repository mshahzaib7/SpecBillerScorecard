import { useEffect, useRef, useState } from 'react';

type Tag = 'div' | 'li' | 'section';

/**
 * Fades content up 12px the first time it scrolls into view (reduced motion: opacity only, no
 * movement). Plain CSS + IntersectionObserver, so it never waits for the lazy-loaded animation code.
 *
 * Safety rules (nothing may stay invisible waiting for an animation):
 * - threshold 0 with a small margin, so it also fires for elements taller than the screen;
 * - no IntersectionObserver (very old browsers) → shown at once;
 * - content that is on screen when the page loads is shown within 1 second even if the observer
 *   has not reported yet;
 * - printing always shows everything (see .fadeup in brand.css).
 */
export function FadeUp({
  children,
  delay = 0,
  className,
  id,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
  as?: Tag;
}) {
  const ref = useRef<HTMLElement>(null);
  // 'idle' renders visible (no flash before JS runs); 'wait' hides until seen; 'in' fades in.
  const [state, setState] = useState<'idle' | 'wait' | 'in'>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const r = el.getBoundingClientRect();
    // Already on screen at mount: show it now rather than risk a flash of hidden content.
    if (r.top < window.innerHeight && r.bottom > 0) return;
    setState('wait');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('in');
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    // Fallback: if the observer never reports while the element is on screen, show it within 1 s.
    const check = window.setInterval(() => {
      const b = el.getBoundingClientRect();
      if (b.top < window.innerHeight && b.bottom > 0) {
        setState('in');
        io.disconnect();
        window.clearInterval(check);
      }
    }, 1000);
    return () => {
      io.disconnect();
      window.clearInterval(check);
    };
  }, []);

  const Comp = as as 'div';
  const cls = ['fadeup', state === 'wait' ? 'fadeup--wait' : '', state === 'in' ? 'fadeup--in' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Comp ref={ref as React.RefObject<HTMLDivElement>} className={cls} id={id} style={delay ? ({ '--fade-delay': `${delay}s` } as React.CSSProperties) : undefined}>
      {children}
    </Comp>
  );
}
