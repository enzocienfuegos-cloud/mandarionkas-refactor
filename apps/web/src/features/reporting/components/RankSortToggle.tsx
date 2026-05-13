import React from 'react';
import { Button } from '../../../system';

export type RankSortDirection = 'desc' | 'asc';

export function RankSortToggle({
  direction,
  onChange,
}: {
  direction: RankSortDirection;
  onChange: (direction: RankSortDirection) => void;
}) {
  const isDescending = direction === 'desc';

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={isDescending ? 'Sort low to high' : 'Sort high to low'}
      onClick={() => onChange(isDescending ? 'asc' : 'desc')}
      className="rounded-full border border-[color:var(--dusk-border-subtle)] px-2.5 text-[11px]"
    >
      {isDescending ? 'High to low' : 'Low to high'}
    </Button>
  );
}
