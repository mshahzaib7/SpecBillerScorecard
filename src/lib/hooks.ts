import { useEffect, useState } from 'react';

/** True while any text input / select is focused (used to hide the sticky bar when the keyboard is open). */
export function useInputFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') &&
      !(el instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'button', 'submit'].includes(el.type));
    const onIn = (e: FocusEvent) => setFocused(isField(e.target));
    const onOut = () => setFocused(false);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);
  return focused;
}

/** Every offer and booking button opens the lead flow: scroll to it and focus its current question. */
export function openLeadFlow(): void {
  scrollToId('lead', '.lf__title');
}

/** Smoothly scrolls to an element id and moves keyboard focus there. */
export function scrollToId(id: string, focusSelector?: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const target = (focusSelector ? el.querySelector<HTMLElement>(focusSelector) : el) ?? el;
  if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
    target.setAttribute('tabindex', '-1');
  }
  target.focus({ preventScroll: true });
}

/**
 * Sticky summary (DESIGN-BRIEF 8): true once `afterId` (the verdict band) has scrolled out above
 * the screen, and none of the `hideIds` (the form and other primary buttons) is on screen, and
 * the keyboard is not open.
 */
export function useSummaryVisible(enabled: boolean, afterId: string, hideIds: string[]): boolean {
  const focused = useInputFocused();
  const [past, setPast] = useState(false);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const key = hideIds.join('|');

  useEffect(() => {
    if (!enabled) return;
    const after = document.getElementById(afterId);
    if (!after) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        setPast(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    io.observe(after);
    return () => io.disconnect();
  }, [enabled, afterId]);

  useEffect(() => {
    if (!enabled) return;
    const els = key.split('|').map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) =>
        setBlocked((prev) => {
          const next = new Set(prev);
          for (const e of entries) (e.isIntersecting ? next.add(e.target.id) : next.delete(e.target.id));
          return next;
        }),
      // threshold 0 + a small margin: fires for elements of any height, on any screen.
      { threshold: 0, rootMargin: '0px 0px -5% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enabled, key]);

  return enabled && past && blocked.size === 0 && !focused;
}
