import React from 'react';
import { Badge } from '../../system';
import type { PrioritySeverity, Tag } from './types';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function tagStatusBadge(status: Tag['status']) {
  const map: Record<Tag['status'], string> = {
    active: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
    paused: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    archived: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
    draft: 'border-[color:var(--dusk-status-neutral-border)] bg-[color:var(--dusk-status-neutral-bg)] text-[color:var(--dusk-status-neutral-fg)]',
  };
  return map[status];
}

export function severityBadge(severity: PrioritySeverity) {
  const map: Record<PrioritySeverity, string> = {
    Critical: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
    Warning: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
    Notice: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
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
      return 'Live';
    case 'paused':
      return 'Paused';
    case 'draft':
      return 'Pending setup';
    case 'archived':
    default:
      return 'Archived';
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

export function getTagPreviewUrl(tag: Tag) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin.replace(/\/+$/, '') : '';
  if (!baseUrl) return null;
  if (tag.format === 'display') {
    return `${baseUrl}/v1/tags/display/${tag.id}.html`;
  }
  if (tag.format === 'VAST') {
    return `${baseUrl}/v1/vast/tags/${tag.id}/default.xml`;
  }
  return null;
}
