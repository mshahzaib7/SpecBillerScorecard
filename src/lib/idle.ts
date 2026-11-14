/**
 * "Run this when the browser is free", on every browser.
 * Safari (all versions) has no requestIdleCallback, so it falls back to a short setTimeout.
 * `maxWait` caps the wait so nothing waits forever on a busy or slow phone.
 */
type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function whenIdle(cb: () => void, maxWait = 1500): () => void {
  const w = window as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: maxWait });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, Math.min(300, maxWait));
  return () => window.clearTimeout(id);
}

/**
 * Runs `cb` once the page has loaded and the browser is idle, or after `maxWait` ms at the
 * latest, whichever comes first. Used to start the hero demo without competing with first paint.
 */
export function afterLoadIdle(cb: () => void, maxWait = 2500): () => void {
  let done = false;
  let cancelIdle: (() => void) | null = null;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  const onLoad = () => {
    cancelIdle = whenIdle(run, 1000);
  };
  const cap = window.setTimeout(run, maxWait);
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });
  return () => {
    done = true;
    window.clearTimeout(cap);
    window.removeEventListener('load', onLoad);
    cancelIdle?.();
  };
}

/** True when the visitor's device asks for reduced motion (battery saver, accessibility settings). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
