import { openLeadFlow } from '../lib/hooks';
import { IconArrowRight } from './Icons';

export const BOOKING_LABEL = 'Book my free billing review';

/**
 * "Book a call" button. It opens the lead flow (the booking calendar loads on the flow's success
 * screen), so every booking starts with the visitor's report request.
 */
export function BookingButton({ className = '' }: { className?: string }) {
  return (
    <button type="button" className={`btn btn--primary ${className}`} onClick={openLeadFlow}>
      {BOOKING_LABEL}
      <IconArrowRight size={20} />
    </button>
  );
}
