import React from 'react';
import { Button } from '../../system';
import type { PreviewModalState } from './types';

type Props = {
  creativeName: string;
  previewHref: string;
  previewKind: 'html' | 'video';
  previewLabel: string;
  versionStatus?: string | null;
  versionSourceKind?: string | null;
  width?: number | null;
  height?: number | null;
  onOpenPreview: (preview: PreviewModalState) => void;
};

export function CreativePreviewCell({
  creativeName,
  previewHref,
  previewKind,
  previewLabel,
  versionStatus,
  versionSourceKind,
  width,
  height,
  onOpenPreview,
}: Props) {
  if (previewHref) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-fit border-brand-500/20 bg-brand-500/10 text-text-brand hover:border-brand-500/30 hover:bg-brand-500/15 hover:text-text-brand"
          onClick={() => {
            onOpenPreview({
              url: previewHref,
              width: Number(width) > 0 ? Number(width) : previewKind === 'video' ? 960 : 300,
              height: Number(height) > 0 ? Number(height) : previewKind === 'video' ? 540 : 250,
              name: creativeName,
              kind: previewKind,
            });
          }}
        >
          {previewLabel}
        </Button>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-text-soft hover:text-text-brand hover:underline"
        >
          Open in tab ↗
        </a>
      </div>
    );
  }

  if (versionSourceKind === 'html5_zip' && String(versionStatus ?? '') === 'processing') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[color:var(--dusk-status-warning-fg)]">Publishing…</span>
        <span className="text-[11px] text-text-soft">Auto-refreshing</span>
      </div>
    );
  }

  return (
    <span className="text-xs text-text-soft">{previewLabel}</span>
  );
}
