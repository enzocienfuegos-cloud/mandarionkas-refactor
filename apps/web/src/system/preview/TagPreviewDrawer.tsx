import React from 'react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { EmptyState } from '../primitives/EmptyState';
import { Panel } from '../primitives/Panel';
import { useToast } from '../feedback/Toast';
import { Kicker } from '../primitives/Badge';
import { Copy, ExternalLink, Eye, RefreshCw } from '../icons';
import { VastEventLog } from './VastEventLog';

export interface TagPreviewTarget {
  id: string;
  name: string;
  format: 'display' | 'VAST' | 'native';
  status: 'active' | 'paused' | 'archived' | 'draft';
  publicUrl: string | null;
  clickUrl: string | null;
  width?: number;
  height?: number;
  updatedAt?: string;
  diagnosticStatus?: 'ok' | 'warning' | 'error';
  diagnosticMessage?: string;
  activeBindingsCount?: number;
}

export interface TagPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  tag: TagPreviewTarget | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRefresh?: () => void;
  onViewDiagnostics?: () => void;
}

function formatTimestamp(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function diagnosticTone(status?: 'ok' | 'warning' | 'error') {
  if (status === 'error') return 'critical';
  if (status === 'warning') return 'warning';
  return 'success';
}

export function TagPreviewDrawer({
  open,
  onClose,
  tag,
  loading = false,
  error = null,
  onRetry,
  onRefresh,
  onViewDiagnostics,
}: TagPreviewDrawerProps) {
  const { toast } = useToast();

  const handleCopy = async (value: string | null, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({ tone: 'success', title: `${label} copied.` });
    } catch {
      toast({ tone: 'critical', title: `Couldn’t copy ${label.toLowerCase()}.` });
    }
  };

  const handleOpen = () => {
    if (!tag?.publicUrl) return;
    window.open(tag.publicUrl, '_blank', 'noopener,noreferrer');
  };

  const viewerWidth = Math.min(tag?.width ?? 320, 728);
  const viewerHeight = Math.min(tag?.height ?? 250, 600);
  const hasPreview = Boolean(tag?.publicUrl);
  const isVast = tag?.format === 'VAST';
  const isNative = tag?.format === 'native';
  const videoLikeUrl = tag?.publicUrl ? /\.(mp4|webm|ogg)(\?.*)?$/i.test(tag.publicUrl) : false;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size={560}
      title={tag?.name ?? 'Tag preview'}
      subtitle={tag ? `${tag.format} · ${tag.status}` : 'Preview drawer'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {tag?.diagnosticStatus && tag.diagnosticStatus !== 'ok' && onViewDiagnostics ? (
            <Button variant="secondary" onClick={onViewDiagnostics}>View diagnostics</Button>
          ) : onRefresh ? (
            <Button variant="primary" leadingIcon={<RefreshCw />} onClick={onRefresh}>Refresh preview</Button>
          ) : null}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-border-subtle bg-surface-1 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Kicker>{`Tag preview · ${tag?.format ?? 'unknown'}`}</Kicker>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                {tag?.width && tag?.height ? <span>{tag.width}×{tag.height}</span> : null}
                {tag ? <Badge tone={tag.status === 'active' ? 'success' : tag.status === 'paused' ? 'warning' : 'neutral'}>{tag.status}</Badge> : null}
                {tag?.diagnosticStatus ? <Badge tone={diagnosticTone(tag.diagnosticStatus)}>{tag.diagnosticStatus.toUpperCase()}</Badge> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Copy />}
                onClick={() => void handleCopy(tag?.publicUrl ?? null, 'Public URL')}
                disabled={!tag?.publicUrl}
              >
                Copy public URL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<ExternalLink />}
                onClick={handleOpen}
                disabled={!tag?.publicUrl}
              >
                Open in new tab
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-[280px] animate-pulse rounded-2xl border border-border-default bg-surface-muted" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-24 animate-pulse rounded-2xl border border-border-default bg-surface-muted" />
              <div className="h-24 animate-pulse rounded-2xl border border-border-default bg-surface-muted" />
            </div>
          </div>
        ) : error ? (
          <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)]">
            <p className="font-semibold text-text-primary">Couldn&apos;t load preview</p>
            <p className="mt-2 text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</p>
            {onRetry ? (
              <Button className="mt-4" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </Panel>
        ) : !tag ? null : !hasPreview ? (
          <EmptyState
            kicker="Preview unavailable"
            title="This tag hasn&apos;t been published yet"
            description="Publish the tag or complete its creative binding before a live preview is available."
            action={onViewDiagnostics ? <Button variant="secondary" onClick={onViewDiagnostics}>View diagnostics</Button> : undefined}
          />
        ) : (
          <>
            <Panel padding="md" className="space-y-4">
              <div className="rounded-2xl border border-dashed border-border-default bg-surface-muted p-4">
                <div className="mx-auto flex items-center justify-center overflow-auto">
                  {isVast ? (
                    videoLikeUrl ? (
                      <video
                        controls
                        src={tag.publicUrl ?? undefined}
                        className="max-h-[360px] w-full rounded-xl border border-border-default bg-black"
                      />
                    ) : (
                      <div className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-border-default bg-surface-1 px-6 py-8 text-center">
                        <Eye className="h-6 w-6 text-text-brand" />
                        <p className="mt-3 text-sm font-medium text-text-primary">VAST preview is ready for player integration</p>
                        <p className="mt-2 max-w-sm text-sm text-text-muted">
                          The XML endpoint is available now. Open it in a new tab or use diagnostics while the inline player callback integration is added.
                        </p>
                      </div>
                    )
                  ) : isNative ? (
                    <div className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-border-default bg-surface-1 px-6 py-8 text-center">
                      <p className="text-sm font-medium text-text-primary">Native preview requires a rendered placement shell</p>
                      <p className="mt-2 max-w-sm text-sm text-text-muted">
                        This drawer is ready for native placement mocks, but the current tag payload does not expose creative fields for a full inline card preview yet.
                      </p>
                    </div>
                  ) : (
                    <iframe
                      title={`${tag.name} preview`}
                      sandbox="allow-scripts allow-same-origin"
                      referrerPolicy="no-referrer"
                      src={tag.publicUrl ?? undefined}
                      style={{ width: viewerWidth, height: viewerHeight }}
                      className="max-w-full rounded-xl border border-border-default bg-white"
                    />
                  )}
                </div>
              </div>

              {isVast ? <VastEventLog /> : null}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              <Panel padding="md" className="space-y-3">
                <div>
                  <Kicker>Metadata</Kicker>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-text-soft">Public URL</div>
                    <div className="mt-1 break-all text-text-primary">{tag.publicUrl ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-soft">Click URL</div>
                    <div className="mt-1 break-all text-text-primary">{tag.clickUrl ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-soft">Last updated</div>
                    <div className="mt-1 text-text-primary">{formatTimestamp(tag.updatedAt)}</div>
                  </div>
                </div>
              </Panel>

              <Panel padding="md" className="space-y-3">
                <div>
                  <Kicker>Operations</Kicker>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-soft">Active bindings</span>
                    <span className="font-medium text-text-primary">{tag.activeBindingsCount ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-soft">Diagnostic status</span>
                    <Badge tone={diagnosticTone(tag.diagnosticStatus)}>{(tag.diagnosticStatus ?? 'ok').toUpperCase()}</Badge>
                  </div>
                  {tag.diagnosticMessage ? (
                    <p className="rounded-xl border border-border-default bg-surface-muted px-3 py-2 text-text-muted">
                      {tag.diagnosticMessage}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<Copy />}
                      onClick={() => void handleCopy(tag.clickUrl ?? null, 'Click URL')}
                      disabled={!tag.clickUrl}
                    >
                      Copy click URL
                    </Button>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
