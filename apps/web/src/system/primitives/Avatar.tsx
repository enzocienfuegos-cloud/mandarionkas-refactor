import React, { useMemo, useState } from 'react';
import { cn } from '../cn';

export interface AvatarProps {
  /** Display name. Initials computed from this. */
  name: string;
  /** Optional URL of avatar image. Falls back to initials if missing/fails. */
  src?: string;
  /** Size. Default 'sm'. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Optional explicit initials override. */
  initials?: string;
  /** Optional ring color (e.g. for 'online' indicator). */
  ringTone?: 'success' | 'warning' | 'critical' | null;
  /** Stable color hash (so same name → same color always). Default true. */
  stableColor?: boolean;
  className?: string;
}

export interface AvatarGroupProps {
  /** Show first N avatars then "+M" overflow chip. Default 3. */
  max?: number;
  size?: AvatarProps['size'];
  children: React.ReactNode;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-5 w-5 rounded',
  sm: 'h-7 w-7 rounded-md',
  md: 'h-10 w-10 rounded-lg',
  lg: 'h-16 w-16 rounded-xl',
};

const textClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'text-[10px]',
  sm: 'text-[11px]',
  md: 'text-sm',
  lg: 'text-xl',
};

const toneClasses = [
  'bg-brand-500/12 text-text-brand',
  'bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  'bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
  'bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
  'bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
  'bg-surface-active text-text-primary',
] as const;

const ringClasses: Record<Exclude<NonNullable<AvatarProps['ringTone']>, null>, string> = {
  success: 'ring-2 ring-[color:var(--dusk-status-success-fg)]/30',
  warning: 'ring-2 ring-[color:var(--dusk-status-warning-fg)]/30',
  critical: 'ring-2 ring-[color:var(--dusk-status-critical-fg)]/30',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function hashName(name: string): number {
  return name.split('').reduce((acc, character) => acc + character.charCodeAt(0), 0);
}

/**
 * Compact assignee/owner avatar with stable color hashing and graceful
 * initials fallback. Useful in dense operational tables where people need
 * visual anchoring without adding extra columns or chrome.
 */
export function Avatar({
  name,
  src,
  size = 'sm',
  initials,
  ringTone = null,
  stableColor = true,
  className,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const derivedInitials = initials ?? getInitials(name);
  const toneClass = useMemo(() => {
    if (!stableColor) return toneClasses[0];
    return toneClasses[hashName(name) % toneClasses.length];
  }, [name, stableColor]);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden border border-[color:var(--dusk-border-default)] font-semibold',
        sizeClasses[size],
        textClasses[size],
        toneClass,
        ringTone ? ringClasses[ringTone] : null,
        className,
      )}
      aria-label={name}
      title={name}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden>{derivedInitials}</span>
      )}
    </span>
  );
}

/**
 * Overlapped avatar stack for compact ownership and approval groups.
 */
export function AvatarGroup({ max = 3, size = 'xs', children }: AvatarGroupProps) {
  const avatars = React.Children.toArray(children).filter(Boolean);
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((child, index) => (
        <div key={index} className={cn(index > 0 && '-ml-2')}>
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            '-ml-2 inline-flex items-center justify-center border border-[color:var(--dusk-border-default)] bg-surface-2 text-[color:var(--dusk-text-muted)]',
            sizeClasses[size],
            textClasses[size],
            'font-semibold',
          )}
          aria-label={`${remaining} more people`}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
