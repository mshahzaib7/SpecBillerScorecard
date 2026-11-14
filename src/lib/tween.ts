/**
 * Counting helpers built on framer-motion's animate(). Only the results chunk imports this file,
 * so the animation engine stays out of the first JS file.
 */
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/** Reduced motion: numbers still change, but quickly (no long counting). */
export const REDUCED_COUNT_S = 0.3;

/**
 * Counts from 0 up to `target` once `start` is true. With reduced motion the count is a quick
 * 300 ms change instead. Returns the current (unrounded) value.
 */
export function useCountUp(target: number, start: boolean, duration = 1.4, delay = 0): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    const controls = animate(0, target, {
      duration: reduce ? REDUCED_COUNT_S : duration,
      delay: reduce ? 0 : delay,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setValue,
    });
    return () => controls.stop();
  }, [target, start, duration, delay, reduce]);
  return value;
}

/**
 * Counts from the previous value to the new one whenever `target` changes (DESIGN-BRIEF 8:
 * figures count, never fade). Reduced motion: a quick 300 ms change.
 */
export function useTweened(target: number, duration = 0.4): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (current.current === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const controls = animate(current.current, target, {
      duration: reduce ? Math.min(duration, REDUCED_COUNT_S) : duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        current.current = v;
        setValue(v);
      },
    });
    return () => controls.stop();
  }, [target, duration, reduce]);
  return value;
}
