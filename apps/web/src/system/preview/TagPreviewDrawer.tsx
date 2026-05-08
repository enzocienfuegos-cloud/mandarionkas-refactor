import React, { useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { EmptyState } from '../primitives/EmptyState';
import { Panel } from '../primitives/Panel';
import { Tab, TabPanel, Tabs, TabsList } from '../primitives/Tabs';
import { useToast } from '../feedback/Toast';
import { Kicker } from '../primitives/Badge';
import { Copy, ExternalLink, Eye, RefreshCw } from '../icons';
import { MacroResolver, type DspMacroSpec } from './MacroResolver';
import { TagDiagnostics, type TagDiagnosticCheck } from './TagDiagnostics';
import { TagSnippetBlock, type TagExportMode } from './TagSnippetBlock';
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
  snippets?: Partial<Record<TagExportMode, string>>;
  macroSpec?: DspMacroSpec;
  mockMacroValues?: Record<string, string>;
  diagnosticChecks?: TagDiagnosticCheck[];
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

function readViewerLimit(token: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  snippets,
  macroSpec,
  mockMacroValues,
  diagnosticChecks,
}: TagPreviewDrawerProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState('preview');

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

  const MAX_VIEWER_WIDTH = readViewerLimit('--dusk-tag-viewer-max-width', 880);
  const MAX_VIEWER_HEIGHT = readViewerLimit('--dusk-tag-viewer-max-height', 720);
  const viewerWidth = Math.min(tag?.width ?? 320, MAX_VIEWER_WIDTH);
  const viewerHeight = Math.min(tag?.height ?? 250, MAX_VIEWER_HEIGHT);
  const hasPreview = Boolean(tag?.publicUrl);
  const isVast = tag?.format === 'VAST';
  const isNative = tag?.format === 'native';
  const videoLikeUrl = tag?.publicUrl ? /\.(mp4|webm|ogg)(\?.*)?$/i.test(tag.publicUrl) : false;
  const hasSnippets = Boolean(snippets && Object.keys(snippets).length > 0);
  const macroSourceTag = snippets?.raw_html
    ?? snippets?.['display-js']
    ?? snippets?.['vast-xml']
    ?? snippets?.['vast-url-vast4-dynamic']
    ?? tag?.publicUrl
    ?? '';
  const hasMacros = Boolean(macroSpec && macroSourceTag);
  const hasDiagnostics = Boolean((diagnosticChecks && diagnosticChecks.length > 0) || tag?.diagnosticMessage);
  const hasSupplementalTabs = hasSnippets || hasMacros || hasDiagnostics || isVast;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="xl"
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
        ) : !tag ? null : !hasPreview && !hasSupplementalTabs ? (
          <EmptyState
            kicker="Preview unavailable"
            title="This tag hasn&apos;t been published yet"
            description="Publish the tag or complete its creative binding before a live preview is available."
            action={onViewDiagnostics ? <Button variant="secondary" onClick={onViewDiagnostics}>View diagnostics</Button> : undefined}
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList aria-label="Tag preview sections">
              <Tab value="preview">Preview</Tab>
              {hasSnippets ? <Tab value="snippet">Snippet</Tab> : null}
              {hasMacros ? <Tab value="macros">Macros</Tab> : null}
              {hasDiagnostics ? <Tab value="diagnostics">Diagnostics</Tab> : null}
              {isVast ? <Tab value="vast">VAST events</Tab> : null}
            </TabsList>

            <TabPanel value="preview">
              <div className="space-y-4">
                <Panel padding="md" className="space-y-4">
                    <div className="rounded-2xl border border-dashed border-border-default bg-surface-muted p-4">
                      <div className="mx-auto flex items-center justify-center overflow-auto">
                      {!hasPreview ? (
                        <div className="flex min-h-[220px] w-full flex-col items-center justify-center rounded-xl border border-border-default bg-surface-1 px-6 py-8 text-center">
                          <Eye className="h-6 w-6 text-text-brand" />
                          <p className="mt-3 text-sm font-medium text-text-primary">Live preview is not available yet</p>
                          <p className="mt-2 max-w-sm text-sm text-text-muted">
                            Snippets, macros and diagnostics can still be reviewed before publish.
                          </p>
                        </div>
                      ) : isVast ? (
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
              </div>
            </TabPanel>

            {hasSnippets ? (
              <TabPanel value="snippet">
                <TagSnippetBlock snippets={snippets ?? {}} />
              </TabPanel>
            ) : null}

            {hasMacros && macroSpec ? (
              <TabPanel value="macros">
                <MacroResolver tag={macroSourceTag} spec={macroSpec} mockValues={mockMacroValues} />
              </TabPanel>
            ) : null}

            {hasDiagnostics ? (
              <TabPanel value="diagnostics">
                <TagDiagnostics checks={diagnosticChecks ?? [{
                  id: 'drawer-diagnostic',
                  label: 'Diagnostic summary',
                  status: tag.diagnosticStatus === 'error' ? 'error' : tag.diagnosticStatus === 'warning' ? 'warning' : 'ok',
                  message: tag.diagnosticMessage,
                }]} />
              </TabPanel>
            ) : null}

            {isVast ? (
              <TabPanel value="vast">
                <VastEventLog />
              </TabPanel>
            ) : null}
          </Tabs>
        )}
      </div>
    </Drawer>
  );
}
