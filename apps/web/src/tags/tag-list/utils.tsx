import React from 'react';
import { Badge } from '../../system';
import type { PrioritySeverity, Tag } from './types';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function tagStatusBadge(status: Tag['status']) {
  const map: Record<Tag['status'], string> = {
    active: 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/25 dark:text-emerald-300',
    paused: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    archived: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
    draft: 'border-border-strong/70 bg-[color:var(--dusk-surface-muted)] text-text-secondary dark:border-white/20 dark:bg-surface-1/[0.12] dark:text-white/70',
  };
  return map[status];
}

export function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/25 dark:text-rose-300',
    Warning: 'border-amber-300/70 bg-amber-50 text-[color:var(--dusk-status-warning-fg)] dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300',
    Notice: 'border-sky-300/70 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/25 dark:text-sky-300',
  };
  return map[severity];
}

export function formatBadge(format: Tag['format']) {
  const tone: Record<Tag['format'], 'info' | 'neutral' | 'warning' | 'success'> = {
    VAST: 'info',
    display: 'neutral',
    native: 'warning',
    tracker: 'success',
  };
  return <Badge tone={tone[format]}>{format}</Badge>;
}

export function getLastSeenLabel(tag: Tag) {
  const createdAt = new Date(tag.createdAt);
  const now = new Date();
  if (createdAt.toDateString() === now.toDateString()) {
    return 'Today';
  }
  return createdAt.toLocaleDateString();
}

export function getFiringLabel(tag: Tag) {
  switch (tag.status) {
    case 'active':
      return '98%';
    case 'paused':
      return '42%';
    case 'draft':
      return 'Missing';
    case 'archived':
    default:
      return 'Ready';
  }
}

export function getDestinationLabel(tag: Tag) {
  if (tag.format === 'tracker') {
    return `Tracker${tag.trackerType ? ` · ${tag.trackerType}` : ''}`;
  }
  if (tag.format === 'display') {
    return tag.sizeLabel ? `Display · ${tag.sizeLabel}` : 'Display container';
  }
  return tag.format;
}

export function getRisk(tag: Tag): PrioritySeverity {
  if (tag.status === 'draft') return 'Critical';
  if (tag.status === 'paused') return 'Warning';
  return 'Notice';
}

export function getOwner(tag: Tag) {
  if (tag.assignedNames?.trim()) {
    return tag.assignedNames.split(',')[0]?.trim() || 'Ad Ops';
  }
  return tag.workspaceName ?? 'Ad Ops';
}
