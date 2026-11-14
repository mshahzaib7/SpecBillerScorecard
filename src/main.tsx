import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, MotionConfig } from 'framer-motion';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      {/* LazyMotion + m components: the DOM animation features load lazily. */}
      <LazyMotion features={loadMotionFeatures} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
);
