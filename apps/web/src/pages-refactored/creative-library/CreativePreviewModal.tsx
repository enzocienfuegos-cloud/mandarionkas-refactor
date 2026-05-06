import React from 'react';
import { ExternalLink, Download } from '../../system/icons';
import { Modal, Button, Badge, Kicker } from '../../system';
import { STATUS_TONE, formatFileSize } from './types';
import type { Creative } from './types';

export interface CreativePreviewModalProps {
  creative: Creative | null;
  onClose: () => void;
}

/**
 * Preview / inspect a single creative.
 *
 * Replaces the inline preview lightbox from the legacy CreativeLibrary,
 * which had its own focus management bugs and didn't lock body scroll.
 */
export function CreativePreviewModal({ creative, onClose }: CreativePreviewModalProps) {
  return (
    <Modal
      open={Boolean(creative)}
      onClose={onClose}
      title={creative?.name}
      description={creative ? `${creative.format} · ${creative.size}` : undefined}
      size="xl"
      footer={
        creative && (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button
              variant="secondary"
              leadingIcon={<ExternalLink />}
              onClick={() => window.open(creative.previewUrl, '_blank', 'noopener')}
            >
              Open in new tab
            </Button>
            <Button variant="primary" leadingIcon={<Download />}>
              Download
            </Button>
          </>
        )
      }
    >
      {creative && (
        <div className="space-y-4">
          {/* Preview frame */}
          <div className="rounded-xl border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] overflow-hidden">
            <iframe
              src={creative.previewUrl}
              title={creative.name}
              className="w-full h-[420px] bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Meta label="Status">
              <Badge tone={STATUS_TONE[creative.status]} dot size="sm">{creative.status}</Badge>
            </Meta>
            <Meta label="Format" value={creative.format} />
            <Meta label="Dimensions" value={creative.size} mono />
            <Meta label="File size" value={formatFileSize(creative.fileSize)} />
            <Meta label="Uploaded" value={new Date(creative.uploadedAt).toLocaleDateString()} />
            <Meta label="By" value={creative.uploadedBy} />
            <Meta
              label="Assignments"
              value={`${creative.campaignAssignments} campaign${creative.campaignAssignments === 1 ? '' : 's'}`}
            />
            {creative.duration != null && (
              <Meta label="Duration" value={`${creative.duration}s`} mono />
            )}
          </div>

          {creative.tags && creative.tags.length > 0 && (
            <div>
              <Kicker className="mb-2">Tags</Kicker>
              <div className="flex flex-wrap gap-1.5">
                {creative.tags.map((tag) => (
                  <Badge key={tag} tone="neutral" size="sm" variant="outline">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Meta({
  label,
  value,
  children,
  mono,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <Kicker>{label}</Kicker>
      {children ?? (
        <p className={`mt-1 text-sm text-[color:var(--dusk-text-primary)] ${mono ? 'dusk-mono' : ''}`}>
          {value}
        </p>
      )}
    </div>
  );
}
