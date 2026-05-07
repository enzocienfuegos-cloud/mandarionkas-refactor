import React from 'react';
import { Button, Icons } from '../../system';
import type { Creative, CreativeVersion } from '../catalog';

type Props = {
  creative: Creative;
  version: CreativeVersion;
  statusUpdateCreativeId: string;
  workspaceBusy: boolean;
  getCreativeOperationalState: (creative: Creative) => 'live' | 'publishing' | 'inactive' | 'attention';
  onToggleOperationalStatus: (creative: Creative) => void | Promise<void>;
  onEditClickUrl: (creative: Creative) => void | Promise<void>;
  onOpenDeliveryManager: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onAssignTag: (creative: Creative, version: CreativeVersion) => void | Promise<void>;
  onDeleteCreative: (creative: Creative) => void | Promise<void>;
};

export function CreativeRowActions({
  creative,
  version,
  statusUpdateCreativeId,
  workspaceBusy,
  getCreativeOperationalState,
  onToggleOperationalStatus,
  onEditClickUrl,
  onOpenDeliveryManager,
  onAssignTag,
  onDeleteCreative,
}: Props) {
  const operationalState = getCreativeOperationalState(creative);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={() => void onToggleOperationalStatus(creative)}
        disabled={statusUpdateCreativeId === creative.id || operationalState === 'publishing'}
        variant={operationalState === 'inactive' ? 'secondary' : 'ghost'}
        size="sm"
        aria-label={`${operationalState === 'inactive' ? 'Set live' : 'Set inactive'} for ${creative.name}`}
      >
        {statusUpdateCreativeId === creative.id ? 'Saving…' : operationalState === 'inactive' ? 'Set live' : 'Set inactive'}
      </Button>
      <Button
        onClick={() => void onEditClickUrl(creative)}
        variant="secondary"
        size="sm"
        aria-label={`${creative.clickUrl ? 'Edit' : 'Set'} destination URL for ${creative.name}`}
      >
        {creative.clickUrl ? 'Edit URL' : 'Set URL'}
      </Button>
      <Button
        onClick={() => void onOpenDeliveryManager(creative, version)}
        variant="secondary"
        size="sm"
        aria-label={`Open ${version.servingFormat === 'vast_video' ? 'renditions' : 'sizes'} manager for ${creative.name}`}
      >
        {version.servingFormat === 'vast_video' ? 'Renditions' : 'Sizes'}
      </Button>
      <Button
        onClick={() => void onAssignTag(creative, version)}
        disabled={workspaceBusy}
        variant="secondary"
        size="sm"
        aria-label={`Assign ${creative.name} to a tag`}
      >
        Assign tag
      </Button>
      <Button
        onClick={() => void onDeleteCreative(creative)}
        variant="danger"
        size="sm"
        aria-label={`Delete ${creative.name}`}
        leadingIcon={<Icons.Trash2 />}
      >
        Delete
      </Button>
    </div>
  );
}
