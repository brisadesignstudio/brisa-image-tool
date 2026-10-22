import type { ReactNode } from 'react';

export type IconName =
  | 'upload'
  | 'plus'
  | 'close'
  | 'trash'
  | 'warning'
  | 'info'
  | 'lock'
  | 'check'
  | 'download'
  | 'chevron-left'
  | 'chevron-right'
  | 'arrow-right'
  | 'sliders'
  | 'sparkle'
  | 'reset'
  | 'save';

const PATHS: Record<IconName, ReactNode> = {
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 14.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  close: (
    <>
      <path d="m6.5 6.5 11 11" />
      <path d="m17.5 6.5-11 11" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 4.6 2.9 17.4A2 2 0 0 0 4.6 20.4h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2.2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 18.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-.5" />
    </>
  ),
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'arrow-right': (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9" />
      <path d="M17 7h3" />
      <circle cx="15" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  sparkle: (
    <path
      d="M12 2.5c.7 5.2 3.6 8.4 9.5 9.5-5.9 1.1-8.8 4.3-9.5 9.5-.7-5.2-3.6-8.4-9.5-9.5 5.9-1.1 8.8-4.3 9.5-9.5Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4.5h4.5" />
    </>
  ),
  save: (
    <>
      <path d="M6 4h9.5L20 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 4v4.5h7" />
      <path d="M8 20v-6h8v6" />
    </>
  ),
};

export function Icon({ name, className = 'icon' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
