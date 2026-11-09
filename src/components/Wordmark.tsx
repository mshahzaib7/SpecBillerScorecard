import { SITE } from '../engine';
import { scrollToId } from '../lib/hooks';

/**
 * Wordmark (DESIGN-BRIEF 11): "Shahzaib Khan" in Archivo 700 / width 112, a jade square
 * as the full stop, and "Medical billing" in Plex Mono. Built as text, not an image.
 * tone="light" → ink on light backgrounds; tone="dark" → white on sapphire / ink.
 */
export function Wordmark({ tone = 'light', as: Tag = 'span' }: { tone?: 'light' | 'dark'; as?: 'span' | 'a' }) {
  // No aria-label: the visible text is the accessible name (WCAG 2.5.3, label in name).
  // The link scrolls to the top with JavaScript, so the URL never gets a #hash.
  const props =
    Tag === 'a'
      ? {
          href: '/',
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            scrollToId('top');
          },
        }
      : {};
  return (
    <Tag className={`wordmark wordmark--${tone}`} {...props}>
      <span className="wordmark__name">
        {SITE.companyName}
        <span className="wordmark__dot" aria-hidden="true" />
      </span>
      <span className="wordmark__sub">Medical billing</span>
    </Tag>
  );
}
