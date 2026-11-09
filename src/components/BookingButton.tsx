import { isPlaceholder, SITE } from '../engine';
import { scrollToId } from '../lib/hooks';
import { IconArrowRight } from './Icons';

export const BOOKING_LABEL = 'Book my free billing review';

/**
 * Primary "book a call" button. While [BOOKING_LINK] is still a placeholder it
 * points at the lead form instead, so visitors never see or hit a placeholder.
 */
export function BookingButton({ className = '' }: { className?: string }) {
  const live = !isPlaceholder(SITE.bookingLink);
  return (
    <a
      className={`btn btn--primary ${className}`}
      href={live ? SITE.bookingLink : '#lead'}
      onClick={(e) => {
        if (live) return;
        // No booking link yet: scroll to the form without adding a #hash to the URL.
        e.preventDefault();
        scrollToId('lead', 'input');
      }}
      {...(live ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {BOOKING_LABEL}
      <IconArrowRight size={20} />
    </a>
  );
}
