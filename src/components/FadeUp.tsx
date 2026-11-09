import { m, useReducedMotion } from 'framer-motion';

type Tag = 'div' | 'li' | 'section';

/** Fades content up 12px the first time it scrolls into view. Reduced motion: shown instantly. */
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
  const reduce = useReducedMotion();
  if (reduce) {
    const Plain = as;
    return (
      <Plain className={className} id={id}>
        {children}
      </Plain>
    );
  }
  const Comp = m[as];
  return (
    <Comp
      className={className}
      id={id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </Comp>
  );
}
