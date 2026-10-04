// Minimal geometric SVG icon set — no emoji in UI chrome.

type IconProps = {
  className?: string;
  style?: React.CSSProperties;
};

function base(props: IconProps) {
  return {
    className: props.className,
    style: props.style,
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** Concentric-ring oracle mark. */
export function OracleMark(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="11" />
      <circle cx="13" cy="13" r="6.5" opacity="0.55" />
      <circle cx="13" cy="13" r="2.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 1.5 3.5 9H7l-1 5.5L11.5 7H8l1-5.5z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 1.8 13.5 3.6v4c0 3.4-2.3 5.9-5.5 7-3.2-1.1-5.5-3.6-5.5-7v-4L8 1.8z" />
      <path d="M8 5.5v3" />
      <circle cx="8" cy="10.4" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1" />
      <path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l1-1" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 11.5 11.5 4.5" />
      <path d="M6 4.5h5.5V10" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function ScrollIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 2.5h7.5a1 1 0 0 1 1 1v9a1.5 1.5 0 0 1-3 0V4" />
      <path d="M4 2.5v9a1.5 1.5 0 0 0 3 0" />
      <path d="M7 6h2.5M7 8.5h2.5" opacity="0.6" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 3.5 5.5 8l4.5 4.5" />
      <path d="M5.5 8H14" />
    </svg>
  );
}
