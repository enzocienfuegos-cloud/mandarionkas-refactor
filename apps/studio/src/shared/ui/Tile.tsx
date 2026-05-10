import type { ReactNode } from 'react';

type TileTone = 'neutral' | 'success' | 'warning' | 'danger';

export function Tile({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: TileTone;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return <div className={`tile tile--${tone} ${className}`.trim()}>{children}</div>;
}
