/**
 * Safe animation wrappers.
 *
 * framer-motion's animation code loads lazily (src/lib/motionFeatures.ts). Until it has loaded,
 * an animated element would sit at its starting style (for example opacity 0), so a slow or
 * failed download could leave content invisible. These wrappers prevent that:
 *
 * - Until the animation code is ready, <Anim> renders a plain element in its final state and
 *   <Presence> renders its children without enter/exit animations.
 * So content never waits for the animation code: it is visible in its final state from the first
 * paint (well inside the 1-second rule).
 * - If the code arrives within MOTION_WAIT_MS of startup (normal case, even on slow phones), the
 *   animations switch on; the visitor is still reading the hero then, so nothing switches mid-task.
 * - If it is later than that, blocked or fails, the page stays plain for the rest of the visit.
 */
import { AnimatePresence, m, type AnimatePresenceProps, type HTMLMotionProps } from 'framer-motion';
import { useSyncExternalStore, type ReactNode } from 'react';

/** How long animations may still switch on after startup. Content is visible either way. */
export const MOTION_WAIT_MS = 4000;

let ready = false;
let gaveUp = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** Call once at startup with the lazy loader's promise. */
export function trackMotionLoad<T>(load: Promise<T>): Promise<T> {
  const timer = window.setTimeout(() => {
    gaveUp = true;
    document.documentElement.classList.add('motion-off');
  }, MOTION_WAIT_MS);
  return load.then(
    (features) => {
      window.clearTimeout(timer);
      if (!gaveUp) {
        ready = true;
        emit();
      }
      return features;
    },
    (err: unknown) => {
      window.clearTimeout(timer);
      gaveUp = true;
      document.documentElement.classList.add('motion-off');
      throw err;
    },
  );
}

const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

/** True once the animation code has loaded in time. */
export function useMotionReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

type AnimTag = 'div' | 'li' | 'span';
type MotionOnly = Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'exit' | 'transition' | 'whileInView' | 'viewport'>;

/** An element that animates once the animation code is ready, and is plain (final state) until then. */
export function Anim({
  as = 'div',
  motion,
  ...rest
}: { as?: AnimTag; motion: MotionOnly } & React.HTMLAttributes<HTMLElement> & { 'data-qkey'?: string }) {
  const isReady = useMotionReady();
  if (!isReady) {
    const Tag = as as 'div';
    return <Tag {...(rest as React.HTMLAttributes<HTMLDivElement>)} />;
  }
  const M = m[as] as typeof m.div;
  return <M {...(rest as unknown as HTMLMotionProps<'div'>)} {...motion} />;
}

/** AnimatePresence once the animation code is ready; plain children (no exit wait) until then. */
export function Presence({ children, ...props }: AnimatePresenceProps & { children?: ReactNode }) {
  const isReady = useMotionReady();
  if (!isReady) return <>{children}</>;
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
}
