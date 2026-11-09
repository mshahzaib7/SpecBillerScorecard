import { SITE } from '../engine';
import { FOOTER_COPY } from '../content/closing';
import { Wordmark } from './Wordmark';

/** Footer (DESIGN-BRIEF 7.13): ink background, white text. */
export function Footer({ canPrint, onMethod }: { canPrint: boolean; onMethod: () => void }) {
  return (
    <footer className="footer2 on-dark">
      <div className="container footer2__grid">
        <Wordmark tone="dark" />
        <nav className="footer2__links" aria-label="Footer">
          <button type="button" onClick={onMethod}>
            {FOOTER_COPY.method}
          </button>
          {canPrint && (
            <button type="button" onClick={() => window.print()}>
              {FOOTER_COPY.print}
            </button>
          )}
        </nav>
        <div className="footer2__fine">
          <p>{FOOTER_COPY.disclaimer}</p>
          <p>{FOOTER_COPY.privacy}</p>
          <p>© 2026 {SITE.companyName}</p>
        </div>
      </div>
    </footer>
  );
}
