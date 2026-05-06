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
          className="w-fit border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 hover:border-fuchsia-300 hover:bg-fuchsia-100 hover:text-fuchsia-700 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300"
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
          className="text-[11px] text-slate-400 hover:text-fuchsia-600 hover:underline dark:text-white/38 dark:hover:text-fuchsia-300"
        >
          Open in tab ↗
        </a>
      </div>
    );
  }

  if (versionSourceKind === 'html5_zip' && String(versionStatus ?? '') === 'processing') {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-amber-600 dark:text-amber-300">Publishing…</span>
        <span className="text-[11px] text-slate-400 dark:text-white/38">Auto-refreshing</span>
      </div>
    );
  }

  return (
    <span className="text-xs text-slate-400 dark:text-white/38">{previewLabel}</span>
  );
}
