import React from 'react';
import { Button, Modal } from '../../system';
import { ExternalLink } from '../../system/icons';
import type { PreviewState } from './types';

export function CreativePreviewModal({ previewState, onClose }: { previewState: PreviewState; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <div className="text-[color:var(--dusk-text-primary)]">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{previewState.name}</div>
            <div className="text-xs text-[color:var(--dusk-text-muted)]">{previewState.width} × {previewState.height}</div>
          </div>
        </div>
      }
      size="xl"
      footer={
        <>
          <a
            href={previewState.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--dusk-border-default)] bg-surface-1 px-4 text-sm font-medium text-[color:var(--dusk-text-primary)] transition hover:border-[color:var(--dusk-border-strong)] hover:bg-surface-hover"
          >
            <ExternalLink className="h-4 w-4" />
            Open in tab
          </a>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="-mx-6 -my-4 flex items-center justify-center bg-[color:var(--dusk-surface-muted)] p-4">
        <div className="flex items-center justify-center bg-[color:var(--dusk-surface-muted)] p-4">
          {previewState.kind === 'video' ? (
            <video
              controls
              autoPlay
              className="max-h-[80vh] max-w-[88vw] rounded-lg bg-black"
              style={{ width: `${previewState.width}px`, height: `${previewState.height}px` }}
              src={previewState.url}
            />
          ) : (
            <iframe
              title={`Preview: ${previewState.name}`}
              src={previewState.url}
              className="rounded-lg bg-surface-1"
              style={{ width: `${previewState.width}px`, height: `${previewState.height}px`, maxWidth: '88vw', maxHeight: '80vh' }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
