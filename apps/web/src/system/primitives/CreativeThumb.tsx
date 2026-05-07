import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../cn';

function hashStops(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const ramps = [
    ['#F1008B', '#FB7185'],
    ['#F1008B', '#A855F7'],
    ['#F1008B', '#22D3EE'],
    ['#EC4899', '#F59E0B'],
  ] as const;
  return ramps[hash % ramps.length];
}

function toneForWeight(weightKb?: number | null) {
  if (!weightKb || weightKb <= 100) return 'border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-2)] text-text-muted';
  if (weightKb > 200) return 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]';
  return 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]';
}

export function CreativeThumb({
  creativeId,
  width,
  height,
  weightKb,
  format,
  previewUrl,
  staticImageUrl,
  className,
}: {
  creativeId: string;
  width?: number | null;
  height?: number | null;
  weightKb?: number | null;
  format?: string | null;
  previewUrl?: string | null;
  staticImageUrl?: string | null;
  className?: string;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const sizeLabel = width && height ? `${width}x${height}` : format ? String(format).toUpperCase() : '—';
  const posterUrl = String(staticImageUrl || '').trim();
  const [start, end] = useMemo(() => hashStops(creativeId), [creativeId]);

  const updatePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelWidth = 360;
    const margin = 16;
    setPosition({
      top: rect.top,
      left: Math.min(window.innerWidth - panelWidth - margin, rect.right + 12),
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
  }, []);

  const beginHover = () => {
    if (!previewUrl) return;
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, 300);
  };

  const endHover = () => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    setOpen(false);
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={cn(
          'relative h-14 w-14 overflow-hidden rounded-2xl border border-[color:var(--dusk-border-default)] shadow-1',
          className,
        )}
        onMouseEnter={beginHover}
        onMouseLeave={endHover}
        style={posterUrl
          ? {
              backgroundImage: `url(${posterUrl})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }
          : {
              backgroundImage: `linear-gradient(135deg, ${start}, ${end})`,
            }}
        aria-label={sizeLabel !== '—' ? `Creative ${sizeLabel}` : 'Creative thumbnail'}
      >
        <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-tight text-white">
          {sizeLabel}
        </span>
        {weightKb && weightKb > 100 ? (
          <span className={cn('absolute right-1 top-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold', toneForWeight(weightKb))}>
            {Math.round(weightKb)}KB
          </span>
        ) : null}
      </div>

      {open && previewUrl && position
        ? createPortal(
            <div
              className="fixed z-[var(--dusk-z-tooltip)] w-[360px] rounded-2xl border border-[color:var(--dusk-border-default)] bg-surface-1 p-3 shadow-overlay"
              style={{ top: position.top, left: Math.max(16, position.left) }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={endHover}
              role="dialog"
              aria-label="Creative quick preview"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-kicker text-text-soft">Quick preview</span>
                <span className="text-xs text-text-muted">{sizeLabel}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)]">
                {String(previewUrl).toLowerCase().match(/\.(mp4|webm|mov)$/) ? (
                  <video src={previewUrl} controls className="block h-[260px] w-full bg-black object-contain" />
                ) : (
                  <iframe
                    title={`Creative preview ${creativeId}`}
                    src={previewUrl}
                    className="block h-[260px] w-full bg-white"
                    sandbox="allow-scripts"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
