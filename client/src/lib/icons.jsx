/**
 * Hand-rolled icon set — one family, 24px grid, 1.5px stroke, round caps.
 * Inline SVG (no dependency, no emoji) so icons inherit `currentColor`
 * and stay crisp at every density.
 */

function Svg({ children, size = 18, strokeWidth = 1.5, title, className = "", ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Today = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const Calendar = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Svg>
);

export const Door = (p) => (
  <Svg {...p}>
    <path d="M14 3H7a1 1 0 0 0-1 1v17h9a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z" />
    <path d="M4 21h16" />
    <circle cx="12.5" cy="12.5" r=".9" fill="currentColor" stroke="none" />
  </Svg>
);

export const Ticket = (p) => (
  <Svg {...p}>
    <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5Z" />
    <path d="M14 6v2M14 11v2M14 16v2" />
  </Svg>
);

export const Megaphone = (p) => (
  <Svg {...p}>
    <path d="M4 10v4a2 2 0 0 0 2 2h1l7 4V4L7 8H6a2 2 0 0 0-2 2Z" />
    <path d="M18 8.5a4 4 0 0 1 0 7" />
  </Svg>
);

export const Clipboard = (p) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" />
    <path d="M9 12.5l2 2 4-4" />
  </Svg>
);

export const Search = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const Plus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const Pencil = (p) => (
  <Svg {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6.5 3 3" />
  </Svg>
);

export const Trash = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

export const X = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const Check = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const ChevronDown = (p) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const ArrowRight = (p) => (
  <Svg {...p}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </Svg>
);

export const Sun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Svg>
);

export const Moon = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);

export const Send = (p) => (
  <Svg {...p}>
    <path d="m4.5 12 15-7-4 15-3.6-5.6L4.5 12Z" />
  </Svg>
);

export const Sparkle = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 16.5 19 18l1.5.5L19 19l-.5 1.5-.5-1.5L16.5 18l1.5-.5Z" />
  </Svg>
);

export const Clock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const Pin = (p) => (
  <Svg {...p}>
    <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </Svg>
);

export const Users = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.5 15.2a5.5 5.5 0 0 1 3 4.3" />
  </Svg>
);

export const Alert = (p) => (
  <Svg {...p}>
    <path d="M10.6 4.2 2.9 17.5A1.6 1.6 0 0 0 4.3 20h15.4a1.6 1.6 0 0 0 1.4-2.5L13.4 4.2a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 9.5v4M12 16.8h.01" />
  </Svg>
);

export const Info = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const CheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
  </Svg>
);

export const Grid = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);

export const Rows = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="5" rx="2" />
    <rect x="3.5" y="14.5" width="17" height="5" rx="2" />
  </Svg>
);

export const Menu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const User = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
  </Svg>
);

export const Tool = (p) => (
  <Svg {...p}>
    <path d="M14.7 6.3a3.8 3.8 0 0 0 4.9 4.9l-8 8a2.6 2.6 0 1 1-3.7-3.7l8-8Z" />
    <path d="M14.7 6.3 12 3.6" />
  </Svg>
);

export const Refresh = (p) => (
  <Svg {...p}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </Svg>
);

export const Spinner = ({ size = 16, className = "", ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={`animate-spin shrink-0 ${className}`}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
