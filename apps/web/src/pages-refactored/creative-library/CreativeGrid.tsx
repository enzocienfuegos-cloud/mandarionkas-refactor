import React from 'react';
import { Eye, Copy, MoreHorizontal, Film, ImageIcon } from '../../system/icons';
import { Badge, Button, IconButton, Skeleton } from '../../system';
import type { Creative } from './types';
import { STATUS_TONE, formatFileSize } from './types';

export interface CreativeGridProps {
  creatives: Creative[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onPreview: (creative: Creative) => void;
  onMore: (creative: Creative, anchor: HTMLElement) => void;
}

/**
 * Card grid view of creatives. Used as the default view in the library.
 */
export function CreativeGrid({
  creatives,
  loading,
  selectedIds,
  onToggleSelection,
  onPreview,
  onMore,
}: CreativeGridProps) {
  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <CreativeCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {creatives.map((creative) => (
        <CreativeCard
          key={creative.id}
          creative={creative}
          selected={selectedIds.has(creative.id)}
          onToggleSelection={() => onToggleSelection(creative.id)}
          onPreview={() => onPreview(creative)}
          onMore={(anchor) => onMore(creative, anchor)}
        />
      ))}
    </div>
  );
}

function CreativeCard({
  creative,
  selected,
  onToggleSelection,
  onPreview,
  onMore,
}: {
  creative: Creative;
  selected: boolean;
  onToggleSelection: () => void;
  onPreview: () => void;
  onMore: (anchor: HTMLElement) => void;
}) {
  const FormatIcon = creative.format === 'video' || creative.format === 'audio' ? Film : ImageIcon;

  return (
    <article
      className={`
        group relative rounded-2xl border bg-surface-1 overflow-hidden transition-all
        ${selected
          ? 'border-brand-500 shadow-brand'
          : 'border-[color:var(--dusk-border-default)] hover:border-[color:var(--dusk-border-strong)] hover:shadow-2'}
      `}
    >
      {/* Selection checkbox */}
      <label className="absolute top-2 left-2 z-10 cursor-pointer">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelection}
          aria-label={`Select ${creative.name}`}
          className="h-4 w-4 cursor-pointer accent-brand-500 rounded shadow-1"
        />
      </label>

      {/* More menu */}
      <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          icon={<MoreHorizontal />}
          size="sm"
          variant="ghost"
          aria-label="More options"
          onClick={(e) => onMore(e.currentTarget as HTMLElement)}
          className="bg-surface-1 shadow-1"
        />
      </div>

      {/* Thumbnail */}
      <button
        type="button"
        onClick={onPreview}
        className="block w-full aspect-[4/3] bg-[color:var(--dusk-surface-muted)] relative overflow-hidden cursor-pointer"
      >
        {creative.thumbnailUrl ? (
          <img
            src={creative.thumbnailUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[color:var(--dusk-text-soft)]">
            <FormatIcon className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-1 text-xs font-medium shadow-2">
            <Eye className="h-3.5 w-3.5" /> Preview
          </span>
        </div>
      </button>

      {/* Meta */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-[color:var(--dusk-text-primary)] truncate">
            {creative.name}
          </p>
          <Badge tone={STATUS_TONE[creative.status]} size="sm">{creative.status}</Badge>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--dusk-text-soft)]">
          <span className="dusk-mono">{creative.size}</span>
          <span>·</span>
          <span>{formatFileSize(creative.fileSize)}</span>
          {creative.duration != null && (
            <>
              <span>·</span>
              <span className="dusk-mono">{creative.duration}s</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function CreativeCardSkeleton() {
  return (
    <article className="rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </article>
  );
}
