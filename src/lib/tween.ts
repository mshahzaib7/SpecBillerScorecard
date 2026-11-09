/**
 * Counting helpers built on framer-motion's animate(). Only the results chunk imports this file,
 * so the animation engine stays out of the first JS file.
 */
import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 up to `target` once `start` is true. With reduced motion the
 * final value shows instantly. Returns the current (unrounded) value.
 */
export function useCountUp(target: number, start: boolean, duration = 1.4, delay = 0): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    if (!start) return;
    const controls = animate(0, target, {
      duration,
      delay,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setValue,
    });
    return () => controls.stop();
  }, [target, start, duration, delay, reduce]);
  return value;
}

/**
 * Counts from the previous value to the new one whenever `target` changes (DESIGN-BRIEF 8:
 * figures count, never fade). Reduced motion: jumps straight to the new value.
 */
export function useTweened(target: number, duration = 0.4): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce || current.current === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const controls = animate(current.current, target, {
      duration,
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
