import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';

import App from './App';
import { trackMotionLoad } from './lib/motion';

/*
 * Animation features load after the first render, in their own file. If they are slow or fail,
 * the page stays fully visible without animations (see src/lib/motion.tsx).
 */
const motionFeatures = trackMotionLoad(import('./lib/motionFeatures').then((m) => m.default));
motionFeatures.catch(() => {
  /* handled in trackMotionLoad: the page simply runs without animations */
});
const loadMotionFeatures = () => motionFeatures;
import './styles/index.css';

/*
 * Vercel Web Analytics counts page views only: no custom events are ever sent. Visitor answers
 * never go into the URL or the title, and as a safety net every event is reduced to the bare page
 * address (origin + path), with any query string or #hash removed.
 */
const pageViewOnly = (event: BeforeSendEvent): BeforeSendEvent | null => {
  if (event.type !== 'pageview') return null;
  const u = new URL(event.url);
  return { ...event, url: u.origin + u.pathname };
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      {/* LazyMotion + m components: the DOM animation features load lazily. */}
      <LazyMotion features={loadMotionFeatures} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
    <Analytics beforeSend={pageViewOnly} />
  </StrictMode>,
);
