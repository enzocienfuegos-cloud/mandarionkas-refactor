/**
 * Shared types for the Creative Library feature.
 *
 * Mirror of the API contract. If the API changes, edit here only.
 */

export type CreativeStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
export type CreativeFormat = 'display' | 'video' | 'native' | 'rich' | 'audio';

export interface Creative {
  id: string;
  name: string;
  format: CreativeFormat;
  size: string;            // e.g. '300x250'
  status: CreativeStatus;
  thumbnailUrl?: string;
  previewUrl: string;
  fileSize: number;        // bytes
  duration?: number;       // seconds, video/audio only
  uploadedAt: string;
  uploadedBy: string;
  campaignAssignments: number;
  tags?: string[];
}

export interface CreativeFilters {
  search:    string;
  format:    CreativeFormat | 'all';
  status:    CreativeStatus | 'all';
  /** ISO date string */
  uploadedAfter?: string;
}

export const FORMAT_OPTIONS: { value: CreativeFormat | 'all'; label: string }[] = [
  { value: 'all',     label: 'All formats' },
  { value: 'display', label: 'Display' },
  { value: 'video',   label: 'Video' },
  { value: 'native',  label: 'Native' },
  { value: 'rich',    label: 'Rich media' },
  { value: 'audio',   label: 'Audio' },
];

export const STATUS_OPTIONS: { value: CreativeStatus | 'all'; label: string }[] = [
  { value: 'all',      label: 'All statuses' },
  { value: 'draft',    label: 'Draft' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

export const STATUS_TONE = {
  draft:    'neutral',
  pending:  'warning',
  approved: 'success',
  rejected: 'critical',
  archived: 'neutral',
} as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
