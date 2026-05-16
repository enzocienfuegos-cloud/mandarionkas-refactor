import { forwardRef, type ReactNode } from 'react';

type TileTone = 'neutral' | 'success' | 'warning' | 'danger';

type TileProps = {
  tone?: TileTone;
  className?: string;
  children: ReactNode;
};

export const Tile = forwardRef<HTMLDivElement, TileProps>(({
  tone = 'neutral',
  className = '',
  children,
}, ref): JSX.Element => {
  return <div ref={ref} className={`tile tile--${tone} ${className}`.trim()}>{children}</div>;
});

Tile.displayName = 'Tile';
