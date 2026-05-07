import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  type CreativeVersion,
  approveCreativeVersion,
  loadCreativeVersionDetail,
  loadPendingReviewVersions,
  rejectCreativeVersion,
} from './catalog';
import { normalizePlatformRole } from '../shared/roles';
import {
  Badge,
  Button,
  CenteredSpinner,
  EmptyState,
  Kicker,
  Panel,
  useToast,
} from '../system';
import { CheckCircle2, Eye, RefreshCw } from '../system/icons';
import { ActionModal } from './creative-approval/ActionModal';
import { CreativePreviewModal } from './creative-approval/CreativePreviewModal';
import { QaPreviewModal } from './creative-approval/QaPreviewModal';
import type { ActionState, PreviewState, QaState } from './creative-approval/types';
import { resolveCreativePreviewHref, resolveCreativePreviewKind } from './creative-approval/utils';

interface User {
  id: string;
  email: string;
  role: string;
}

export default function CreativeApproval() {
  const { user } = useOutletContext<{ user: User }>();
  const { toast } = useToast();
  const [versions, setVersions] = useState<CreativeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [qaState, setQaState] = useState<QaState | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [processed, setProcessed] = useState<Set<string>>(new Set());

  const canAct = normalizePlatformRole(user?.role) === 'admin';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setVersions(await loadPendingReviewVersions());
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!previewState) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewState(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewState]);

  const pending = versions.filter((version) => !processed.has(version.id));

  const handleAction = async () => {
    if (!actionState) return;
    setActionState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      if (actionState.type === 'approve') {
        await approveCreativeVersion(actionState.versionId, actionState.notes.trim() || undefined);
      } else {
        if (!actionState.reason.trim()) {
          throw new Error('Rejection reason is required.');
        }
        await rejectCreativeVersion(actionState.versionId, actionState.reason.trim());
      }
      setProcessed((current) => new Set([...current, actionState.versionId]));
      toast({
        tone: 'success',
        title: actionState.type === 'approve' ? 'Creative approved' : 'Creative rejected',
      });
      setActionState(null);
    } catch (actionError: any) {
      toast({
        tone: 'critical',
        title: actionError.message ?? 'Action failed',
      });
      setActionState((current) => current ? { ...current, loading: false, error: actionError.message ?? 'Action failed' } : current);
    }
  };

  const openQa = async (versionId: string) => {
    setQaState({
      versionId,
      loading: true,
      error: '',
      version: null,
      artifacts: [],
    });
    try {
      const detail = await loadCreativeVersionDetail(versionId);
      setQaState({
        versionId,
        loading: false,
        error: '',
        version: detail.creativeVersion,
        artifacts: detail.artifacts,
      });
    } catch (qaError: any) {
      setQaState({
        versionId,
        loading: false,
        error: qaError.message ?? 'Failed to load QA detail',
        version: null,
        artifacts: [],
      });
    }
  };

  if (loading) {
    return <CenteredSpinner label="Loading creative review queue…" />;
  }

  if (error) {
    return (
      <Panel padding="md" className="border-[color:var(--dusk-status-critical-border)]">
        <p className="font-medium text-[color:var(--dusk-status-critical-fg)]">Error loading review queue</p>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">{error}</p>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Kicker>Creative Approval</Kicker>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">Creative Version Review</h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            {pending.length} version{pending.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <Button variant="secondary" leadingIcon={<RefreshCw />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {!canAct && (
        <Panel padding="md" className="border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]">
          You have read-only access. Only admins can approve or reject versions.
        </Panel>
      )}

      {pending.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<CheckCircle2 />}
            title="Queue is empty"
            description="All submitted versions have been reviewed."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {pending.map((version) => (
            <Panel key={version.id} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-semibold text-[color:var(--dusk-text-primary)]">{version.creativeName ?? version.creativeId}</h3>
                    <Badge tone="warning" size="sm">In review</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-[color:var(--dusk-text-muted)]">
                    <span>Version: <strong className="text-[color:var(--dusk-text-secondary)]">v{version.versionNumber}</strong></span>
                    <span>Source: <strong className="text-[color:var(--dusk-text-secondary)]">{version.sourceKind}</strong></span>
                    <span>Format: <strong className="text-[color:var(--dusk-text-secondary)]">{version.servingFormat}</strong></span>
                    <span>Created: <strong className="text-[color:var(--dusk-text-secondary)]">{version.createdAt ? new Date(version.createdAt).toLocaleString() : '—'}</strong></span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {resolveCreativePreviewHref(version) && (
                    <Button
                      type="button"
                      onClick={() => {
                        const url = resolveCreativePreviewHref(version);
                        if (!url) return;
                        const kind = resolveCreativePreviewKind(version);
                        setPreviewState({
                          url,
                          name: version.creativeName ?? version.creativeId,
                          width: Number(version.width) > 0 ? Number(version.width) : kind === 'video' ? 960 : 300,
                          height: Number(version.height) > 0 ? Number(version.height) : kind === 'video' ? 540 : 250,
                          kind,
                        });
                      }}
                      variant="secondary"
                      size="sm"
                      leadingIcon={<Eye />}
                    >
                      Preview
                    </Button>
                  )}
                  <Button onClick={() => void openQa(version.id)} variant="secondary" size="sm">
                    QA
                  </Button>
                  {canAct && (
                    <>
                      <Button size="sm" onClick={() => setActionState({ versionId: version.id, type: 'approve', notes: '', reason: '', loading: false, error: '' })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setActionState({ versionId: version.id, type: 'reject', notes: '', reason: '', loading: false, error: '' })}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {actionState && (
        <ActionModal
          actionState={actionState}
          onClose={() => setActionState(null)}
          onSubmit={() => void handleAction()}
          onChange={(patch) => setActionState((current) => current ? { ...current, ...patch } : current)}
        />
      )}

      {qaState && <QaPreviewModal qaState={qaState} onClose={() => setQaState(null)} />}

      {previewState && <CreativePreviewModal previewState={previewState} onClose={() => setPreviewState(null)} />}
    </div>
  );
}
