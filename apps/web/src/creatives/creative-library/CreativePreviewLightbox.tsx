import React from 'react';
import { Button } from '../../system';
import type { PreviewModalState } from './types';

type Props = {
  preview: PreviewModalState;
  onClose: () => void;
};

export function CreativePreviewLightbox({ preview, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${preview.name}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between gap-4 rounded-lg bg-white/10 px-4 py-2">
          <div className="text-sm font-medium text-white">
            {preview.name}
            <span className="ml-2 text-xs font-normal text-white/60">
              {preview.width}×{preview.height}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              Open in tab ↗
            </a>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="border border-white/20 text-white hover:bg-white/10 hover:text-white"
              aria-label="Close preview"
            >
              Close preview
            </Button>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-lg shadow-2xl"
          style={{ width: preview.width, height: preview.height }}
        >
          {preview.kind === 'video' ? (
            <video
              src={preview.url}
              controls
              playsInline
              preload="metadata"
              style={{
                width: preview.width,
                height: preview.height,
                display: 'block',
                background: '#000',
              }}
              title={`Preview: ${preview.name}`}
            />
          ) : (
            <iframe
              src={preview.url}
              width={preview.width}
              height={preview.height}
              style={{
                width: preview.width,
                height: preview.height,
                border: 'none',
                display: 'block',
              }}
              title={`Preview: ${preview.name}`}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}
        </div>

        <p className="text-xs text-white/40">
          Click outside or press Esc to close
        </p>
      </div>
    </div>
  );
}
