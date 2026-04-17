import type { JSX, ReactNode } from 'react';

type IconProps = {
  className?: string;
};

function Svg({ children, className, viewBox = '0 0 24 24' }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox={viewBox}
    >
      {children}
    </svg>
  );
}

export function BoltIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M13 2 5 14h6l-1 8 8-12h-6z" /></Svg>;
}

export function HomeIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /></Svg>;
}

export function FolderIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z" /></Svg>;
}

export function TemplateIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h5M8 17h8" /></Svg>;
}

export function MediaIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.5" /><path d="m21 16-5-5-6 6" /></Svg>;
}

export function ExportIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M12 3v12" /><path d="m8 8 4-5 4 5" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></Svg>;
}

export function UsersIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="3" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 4.13a3 3 0 0 1 0 5.74" /></Svg>;
}

export function ShieldIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>;
}

export function ReportIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m8 15 3-4 3 2 4-6" /></Svg>;
}

export function ActivityIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M3 12h4l2.5-6L14 18l2.5-6H21" /></Svg>;
}

export function SettingsIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M12 3v3" /><path d="M12 18v3" /><path d="m4.93 4.93 2.12 2.12" /><path d="m16.95 16.95 2.12 2.12" /><path d="M3 12h3" /><path d="M18 12h3" /><path d="m4.93 19.07 2.12-2.12" /><path d="m16.95 7.05 2.12-2.12" /><circle cx="12" cy="12" r="4" /></Svg>;
}

export function SearchIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></Svg>;
}

export function BellIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></Svg>;
}

export function ChevronDownIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="m6 9 6 6 6-6" /></Svg>;
}

export function PlusIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function LayoutIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="4" y="5" width="6" height="6" rx="1.5" /><rect x="14" y="5" width="6" height="6" rx="1.5" /><rect x="4" y="13" width="6" height="6" rx="1.5" /><rect x="14" y="13" width="6" height="6" rx="1.5" /></Svg>;
}

export function FilterIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></Svg>;
}

export function ListIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M8 7h12M8 12h12M8 17h12" /><path d="M4 7h.01M4 12h.01M4 17h.01" /></Svg>;
}

export function GridIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></Svg>;
}

export function DotsIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" /></Svg>;
}

export function DuplicateIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="8" y="8" width="10" height="10" rx="2" /><path d="M6 14H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" /></Svg>;
}

export function UploadIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M12 16V5" /><path d="m7 10 5-5 5 5" /><path d="M5 18v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" /></Svg>;
}

export function ArrowRightIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
}

export function CheckIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="m5 12 4 4 10-10" /></Svg>;
}

export function ClockIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></Svg>;
}

export function ColumnsIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><path d="M4 5h16" /><path d="M9 5v14" /><path d="M15 5v14" /><path d="M4 19h16" /></Svg>;
}

export function ImageStackIcon({ className }: IconProps): JSX.Element {
  return <Svg className={className}><rect x="4" y="6" width="16" height="12" rx="2.5" /><path d="M8 12h.01" /><path d="m20 15-4.5-4.5L9 17" /></Svg>;
}
