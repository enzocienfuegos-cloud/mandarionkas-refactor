import React, { useMemo } from 'react';
import { Button, type ColumnDef } from '../../system';
import { type IconProps, type Tag } from './types';
import {
  classNames,
  formatBadge,
  getDestinationLabel,
  getFiringLabel,
  getLastSeenLabel,
  getOwner,
  getRisk,
  severityBadge,
  tagStatusBadge,
} from './utils';

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

type Params = {
  deletingId: string | null;
  onEdit: (tag: Tag) => void;
  onExport: (tag: Tag) => void | Promise<void>;
  onDelete: (tag: Tag) => void | Promise<void>;
};

export function useTagColumns({ deletingId, onEdit, onExport, onDelete }: Params) {
  return useMemo<ColumnDef<Tag>[]>(() => [
    {
      id: 'tag',
      header: 'Tag',
      sortAccessor: (tag) => tag.name,
      cell: (tag) => (
        <div>
          <p className="font-semibold text-[color:var(--dusk-text-primary)]">{tag.name}</p>
          <p className="mt-1 text-xs text-text-muted">
            {tag.workspaceName ?? 'Workspace'} · {tag.campaign?.name ?? 'No campaign'}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (tag) => tag.status,
      cell: (tag) => (
        <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize', tagStatusBadge(tag.status))}>
          {tag.status}
        </span>
      ),
    },
    {
      id: 'firing',
      header: 'Signal state',
      sortAccessor: (tag) => getFiringLabel(tag),
      cell: (tag) => <span className="font-medium text-text-secondary">{getFiringLabel(tag)}</span>,
    },
    {
      id: 'destination',
      header: 'Destination',
      sortAccessor: (tag) => getDestinationLabel(tag),
      cell: (tag) => (
        <div className="flex flex-col gap-2">
          {formatBadge(tag.format)}
          <span className="text-xs text-text-muted">{getDestinationLabel(tag)}</span>
        </div>
      ),
    },
    {
      id: 'last-seen',
      header: 'Last seen',
      sortAccessor: (tag) => tag.createdAt,
      cell: (tag) => <span className="text-text-muted">{getLastSeenLabel(tag)}</span>,
    },
    {
      id: 'risk',
      header: 'Risk',
      sortAccessor: (tag) => getRisk(tag),
      cell: (tag) => {
        const risk = getRisk(tag);
        return <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs font-semibold', severityBadge(risk))}>{risk}</span>;
      },
    },
    {
      id: 'owner',
      header: 'Owner',
      sortAccessor: (tag) => getOwner(tag),
      cell: (tag) => <span className="text-text-muted">{getOwner(tag)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (tag) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onExport(tag);
            }}
            aria-label={`Export ${tag.name}`}
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <ReportIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(tag);
            }}
            aria-label={`Edit ${tag.name}`}
            variant="ghost"
            size="sm"
            className="px-2"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete(tag);
            }}
            disabled={deletingId === tag.id}
            aria-label={`Delete ${tag.name}`}
            variant="danger"
            size="sm"
          >
            {deletingId === tag.id ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      ),
    },
  ], [deletingId, onDelete, onEdit, onExport]);
}
