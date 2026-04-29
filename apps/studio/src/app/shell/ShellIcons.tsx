import type { JSX, ReactNode } from 'react';

type IconProps = {
  className?: string;
};

function ShellIcon({ children, className }: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function PanelsIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </ShellIcon>
  );
}

export function LayersIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="M12 4 20 8l-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </ShellIcon>
  );
}

export function AssetsIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m8 14 2.5-2.5a1.5 1.5 0 0 1 2.1 0L16 15" />
      <path d="m13 12 1.5-1.5a1.5 1.5 0 0 1 2.1 0L20 14" />
      <circle cx="9" cy="9" r="1.25" />
    </ShellIcon>
  );
}

export function FlowIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="M7 7h10" />
      <path d="m13 4 4 3-4 3" />
      <path d="M17 17H7" />
      <path d="m11 14-4 3 4 3" />
    </ShellIcon>
  );
}

export function SettingsIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1 0 2.8 2 2 0 0 1-2.8 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 0-2.8 2 2 0 0 1 2.8 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 0 2 2 0 0 1 0 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.4.1" />
    </ShellIcon>
  );
}

export function BackArrowIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="M15 18 9 12l6-6" />
    </ShellIcon>
  );
}

export function ChevronLeftIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="m15 18-6-6 6-6" />
    </ShellIcon>
  );
}

export function ChevronRightIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="m9 18 6-6-6-6" />
    </ShellIcon>
  );
}

export function ChevronUpIcon({ className }: IconProps): JSX.Element {
  return (
    <ShellIcon className={className}>
      <path d="m18 15-6-6-6 6" />
    </ShellIcon>
  );
}
