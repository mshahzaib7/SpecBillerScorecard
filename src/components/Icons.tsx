/** Simple line icons (SVG, currentColor). Decorative unless given a title. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconArrowRight = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const IconArrowLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);
export const IconCheck = (p: P) => (
  <Base {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Base>
);
export const IconCheckCircle = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.8 2.8L16.5 9.5" />
  </Base>
);
export const IconAlert = (p: P) => (
  <Base {...p}>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 10v4.5M12 17.2v.01" />
  </Base>
);
export const IconXCircle = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Base>
);
export const IconInfo = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.01" />
  </Base>
);
export const IconHelp = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.01" />
  </Base>
);
export const IconStar = (p: P) => (
  <Base {...p}>
    <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />
  </Base>
);
export const IconChevronDown = (p: P) => (
  <Base {...p}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);
export const IconLock = (p: P) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </Base>
);
export const IconGift = (p: P) => (
  <Base {...p}>
    <rect x="4" y="9" width="16" height="11" rx="2" />
    <path d="M4 13h16M12 9v11M12 9c-1.5-3.5-5.5-3.5-5.5-1S10 9 12 9zm0 0c1.5-3.5 5.5-3.5 5.5-1S14 9 12 9z" />
  </Base>
);
export const IconUserOff = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
  </Base>
);
export const IconPin = (p: P) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);
export const IconMinusCircle = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </Base>
);
export const IconCalendar = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Base>
);
export const IconTarget = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Base>
);
export const IconRoute = (p: P) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2.2" />
    <circle cx="18" cy="6" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" />
  </Base>
);
export const IconShare = (p: P) => (
  <Base {...p}>
    <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8" />
    <path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Base>
);
export const IconSwap = (p: P) => (
  <Base {...p}>
    <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
  </Base>
);
export const IconPrinter = (p: P) => (
  <Base {...p}>
    <path d="M7 9V3.5h10V9" />
    <rect x="3.5" y="9" width="17" height="8" rx="2" />
    <path d="M7 14h10v6.5H7z" />
  </Base>
);
export const IconMail = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="m4 7.5 8 6 8-6" />
  </Base>
);
export const IconUser = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Base>
);
export const IconUsers = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3 19.5c.6-3 2.9-4.7 6-4.7s5.4 1.7 6 4.7" />
    <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17.5 14.9c1.8.6 3 2.1 3.5 4.6" />
  </Base>
);
export const IconBuilding = (p: P) => (
  <Base {...p}>
    <path d="M4.5 20.5V5.5l8-2.5v17.5M12.5 8.5h7v12" />
    <path d="M3 20.5h18M7.5 8.5h2M7.5 12h2M7.5 15.5h2M15.5 12h1.5M15.5 15.5h1.5" />
  </Base>
);
export const IconMix = (p: P) => (
  <Base {...p}>
    <path d="M3.5 7h4c4 0 5 10 9 10h4M3.5 17h4c1.6 0 2.7-1.6 3.6-3.5M13.4 10.5c.8-1.9 1.8-3.5 3.1-3.5h4" />
    <path d="M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
  </Base>
);
export const IconPhone = (p: P) => (
  <Base {...p}>
    <path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
  </Base>
);
export const IconChat = (p: P) => (
  <Base {...p}>
    <path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Base>
);
