/**
 * One icon set, one grid: 24-unit viewBox, 1.6 stroke, round joins,
 * currentColor. Icons inherit the text tone so they never carry their own color.
 */

type P = { size?: number };

function make(path: React.ReactNode, filled = false) {
  return function Icon({ size = 16 }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    );
  };
}

export const Icon = {
  shield: make(<path d="M12 3l7 2.8v5.4c0 4.4-2.9 8.2-7 9.8-4.1-1.6-7-5.4-7-9.8V5.8L12 3z" />),
  flask: make(
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L4.8 19a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3" />
      <path d="M7.4 15h9.2" />
    </>,
  ),
  inbox: make(
    <>
      <path d="M4 13.2 6.4 5h11.2L20 13.2V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-5.8z" />
      <path d="M4 13.2h4.2l1.4 2.4h4.8l1.4-2.4H20" />
    </>,
  ),
  grid: make(
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10" />
    </>,
  ),
  check: make(<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />, false),
  x: make(<path d="M6 6l12 12M18 6L6 18" />),
  play: make(<path d="M8 5.4v13.2L19 12 8 5.4z" />, true),
  reset: make(
    <>
      <path d="M4.5 9.5a8 8 0 1 1 1.6 7.4" />
      <path d="M4.5 4.5v5h5" />
    </>,
  ),
  bolt: make(<path d="M13.2 3 5.5 13.2h4.8L9 21l7.7-10.2h-4.8L13.2 3z" />),
  inject: make(
    <>
      <path d="M19.5 4.5 12 12" />
      <path d="M15.2 8.3 17.7 10.8" />
      <path d="M11 13 5.5 18.5" />
      <path d="M8.4 10.4 13.6 15.6" />
      <path d="M4 20l.6-2.6L3 15.8l2.6.6L10 20.8" />
    </>,
  ),
  handshake: make(
    <>
      <path d="M3 11.5 7 6l5 1.2L17 6l4 5.5" />
      <path d="M7 6v8.2l5 4.8 5-4.8V6" />
      <path d="M12 7.2V11" />
    </>,
  ),
  search: make(
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.6 15.6 20 20" />
    </>,
  ),
  wallet: make(
    <>
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11a2 2 0 0 1 2 2v1" />
      <rect x="3.5" y="7.5" width="17" height="11" rx="2" />
      <path d="M16.5 13h1.5" />
    </>,
  ),
  gavel: make(
    <>
      <path d="M4 20h9" />
      <path d="M7.5 16.5 15 9" />
      <path d="M12.5 4.5 18 10l2.5-2.5L15 2z" />
      <path d="M9.5 7.5 15 13" />
    </>,
  ),
  clock: make(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 1.8" />
    </>,
  ),
  chevron: make(<path d="M9 6l6 6-6 6" />),
  activity: make(<path d="M3 12.5h4l2.5-7 4 14 2.5-7H21" />),
  cpu: make(
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
    </>,
  ),
  link: make(
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M12.8 7.5 14.6 5.7a3.2 3.2 0 0 1 4.5 4.5l-1.8 1.8" />
      <path d="M11.2 16.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5l1.8-1.8" />
    </>,
  ),
  filter: make(<path d="M4 6h16l-6 7.2V19l-4-2v-3.8L4 6z" />),
  dot: make(<circle cx="12" cy="12" r="4" />, true),
  alert: make(
    <>
      <path d="M12 4.5 20.5 20H3.5L12 4.5z" />
      <path d="M12 10v4M12 16.6v.6" />
    </>,
  ),
};
