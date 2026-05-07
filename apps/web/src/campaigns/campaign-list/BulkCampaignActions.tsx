import React from 'react';
import { Badge, Button } from '../../system';
import { FolderOpen, Pause, Play, Trash2 } from '../../system/icons';
import type { CampaignRow } from './types';

interface Props {
  campaigns: CampaignRow[];
  loading?: boolean;
  onPause: (rows: CampaignRow[]) => void;
  onResume: (rows: CampaignRow[]) => void;
  onArchive: (rows: CampaignRow[]) => void;
  onDelete: (rows: CampaignRow[]) => void;
}

export function BulkCampaignActions({
  campaigns,
  loading = false,
  onPause,
  onResume,
  onArchive,
  onDelete,
}: Props) {
  const live = campaigns.filter((campaign) => campaign.raw.status === 'active');
  const paused = campaigns.filter((campaign) => campaign.raw.status === 'paused');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge tone="info" size="sm">{campaigns.length} selected</Badge>
      {live.length > 0 ? (
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Pause />}
          onClick={() => onPause(live)}
          disabled={loading}
        >
          Pause {live.length}
        </Button>
      ) : null}
      {paused.length > 0 ? (
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<Play />}
          onClick={() => onResume(paused)}
          disabled={loading}
        >
          Resume {paused.length}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        leadingIcon={<FolderOpen />}
        onClick={() => onArchive(campaigns)}
        disabled={loading}
      >
        Archive
      </Button>
      <Button
        size="sm"
        variant="ghost"
        leadingIcon={<Trash2 />}
        onClick={() => onDelete(campaigns)}
        disabled={loading}
      >
        Delete
      </Button>
    </div>
  );
}
