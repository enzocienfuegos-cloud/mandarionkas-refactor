import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Eye, Calendar } from '../system/icons';
import {
  Panel,
  Button,
  Badge,
  Kicker,
  Modal,
  CenteredSpinner,
  EmptyState,
  DataTable,
  PageHeader,
  Stepper,
  type Step,
  type ColumnDef,
  useToast,
  useConfirm,
} from '../system';

interface CreativeReview {
  id: string;
  name: string;
  campaignName: string;
  size: string;
  format: string;
  submittedAt: string;
  submittedBy: string;
  previewUrl: string;
  status: 'pending' | 'approved' | 'rejected';
}

type ApprovalWorkflowStepId = 'asset' | 'qa' | 'signoff' | 'traffic';
const APPROVAL_WORKFLOW_ORDER: ApprovalWorkflowStepId[] = ['asset', 'qa', 'signoff', 'traffic'];

/**
 * Creative approval queue — refactored to the Dusk design system (S56).
 *
 * - Uses Modal primitive for the preview lightbox (focus trap, ESC).
 * - Uses Button variant="danger" / "primary" instead of bg-red-600 / bg-green-600.
 * - Uses useConfirm() to gate destructive rejection with a typed reason.
 * - Uses useToast() for in-flight feedback.
 */
export default function CreativeApproval() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const confirm   = useConfirm();

  const [items, setItems]       = useState<CreativeReview[]>([]);
  const [loading, setLoading]   = useState(true);
  const [previewing, setPreviewing] = useState<CreativeReview | null>(null);
  const [busyIds, setBusyIds]       = useState<Set<string>>(new Set());
  const workflowStep = (searchParams.get('step') as ApprovalWorkflowStepId | null) ?? 'asset';

  useEffect(() => {
    setLoading(true);
    fetch('/v1/creatives?status=pending', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setItems(data?.items ?? []))
      .catch(() => toast({ tone: 'critical', title: 'Failed to load creatives' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleApprove = async (creative: CreativeReview) => {
    setBusy(creative.id, true);
    try {
      const res = await fetch(`/v1/creatives/${creative.id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('approve failed');
      setItems((current) => current.filter((c) => c.id !== creative.id));
      if (id === creative.id) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('step', 'traffic');
        setSearchParams(nextParams, { replace: true });
      }
      toast({ tone: 'success', title: 'Creative approved', description: creative.name });
    } catch {
      toast({ tone: 'critical', title: 'Could not approve' });
    } finally {
      setBusy(creative.id, false);
    }
  };

  const handleReject = async (creative: CreativeReview) => {
    const ok = await confirm({
      title: 'Reject this creative?',
      description: `Rejecting "${creative.name}" will notify the submitter. This action cannot be undone.`,
      tone: 'danger',
      confirmLabel: 'Reject creative',
    });
    if (!ok) return;

    setBusy(creative.id, true);
    try {
      const res = await fetch(`/v1/creatives/${creative.id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('reject failed');
      setItems((current) => current.filter((c) => c.id !== creative.id));
      if (id === creative.id) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('step', 'traffic');
        setSearchParams(nextParams, { replace: true });
      }
      toast({ tone: 'warning', title: 'Creative rejected', description: creative.name });
    } catch {
      toast({ tone: 'critical', title: 'Could not reject' });
    } finally {
      setBusy(creative.id, false);
    }
  };

  const columns: ColumnDef<CreativeReview>[] = [
    {
      id: 'name',
      header: 'Creative',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.name}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">{row.campaignName}</p>
        </div>
      ),
      sortAccessor: (row) => row.name,
      width: '34%',
    },
    {
      id: 'size',
      header: 'Format',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge tone="neutral" size="sm" variant="outline">{row.format}</Badge>
          <span className="dusk-mono text-xs text-[color:var(--dusk-text-muted)]">{row.size}</span>
        </div>
      ),
      sortAccessor: (row) => row.size,
    },
    {
      id: 'submitted',
      header: 'Submitted',
      cell: (row) => (
        <div className="text-xs text-[color:var(--dusk-text-muted)]">
          <p className="text-[color:var(--dusk-text-secondary)]">{row.submittedBy}</p>
          <p className="mt-0.5 inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(row.submittedAt).toLocaleDateString()}
          </p>
        </div>
      ),
      sortAccessor: (row) => row.submittedAt,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => {
        const busy = busyIds.has(row.id);
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/creatives/${row.id}/approve?step=asset`);
              }}
            >
              Review flow
            </Button>
            <Button size="sm" variant="ghost" leadingIcon={<Eye />} onClick={(e) => { e.stopPropagation(); setPreviewing(row); }}>
              Preview
            </Button>
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<CheckCircle2 />}
              loading={busy}
              onClick={(e) => { e.stopPropagation(); void handleApprove(row); }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              leadingIcon={<AlertCircle />}
              loading={busy}
              onClick={(e) => { e.stopPropagation(); void handleReject(row); }}
            >
              Reject
            </Button>
          </div>
        );
      },
    },
  ];
  const selectedReview = id ? items.find((item) => item.id === id) ?? null : null;
  const currentStep = APPROVAL_WORKFLOW_ORDER.includes(workflowStep) ? workflowStep : 'asset';
  const currentStepIndex = APPROVAL_WORKFLOW_ORDER.indexOf(currentStep);
  const reviewWorkflowSteps: Step[] = APPROVAL_WORKFLOW_ORDER.map((stepId, index) => ({
    id: stepId,
    label:
      stepId === 'asset'
        ? 'Asset'
        : stepId === 'qa'
          ? 'QA preview'
          : stepId === 'signoff'
            ? 'Sign-off'
            : 'Traffic to',
    description:
      stepId === 'asset'
        ? 'Check source, size and preview payload.'
        : stepId === 'qa'
          ? 'Validate what ops will actually traffic.'
          : stepId === 'signoff'
            ? 'Approve or reject the submission.'
            : 'Hand off the reviewed asset.',
    status: index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming',
    badge:
      stepId === 'traffic' && selectedReview
        ? { label: selectedReview.status === 'pending' ? 'Queued' : selectedReview.status, tone: selectedReview.status === 'pending' ? 'warning' : 'success' }
        : undefined,
  }));

  return (
    <div className="max-w-content mx-auto pb-12">
      <PageHeader
        kicker="Approval queue"
        title={selectedReview ? 'Creative approval workflow' : 'Creatives pending review'}
        meta={selectedReview ? `${selectedReview.name} · ${selectedReview.format} · submitted by ${selectedReview.submittedBy}` : `${items.length} pending creatives · approve or reject before trafficking`}
        secondaryActions={selectedReview ? (
          <Button variant="secondary" onClick={() => navigate('/creatives/approval')}>
            Back to queue
          </Button>
        ) : (
          <Badge tone="info" size="md">{items.length} pending</Badge>
        )}
      />

      {loading ? (
        <CenteredSpinner label="Loading creatives…" />
      ) : selectedReview ? (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Panel padding="md" className="h-fit">
            <div className="mb-4">
              <Kicker>Workflow</Kicker>
              <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
                Review the asset, check QA context, sign off, then hand the approved creative to trafficking.
              </p>
            </div>
            <Stepper
              steps={reviewWorkflowSteps}
              onStepClick={(stepId) => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set('step', stepId);
                setSearchParams(nextParams, { replace: true });
              }}
            />
          </Panel>

          <div className="space-y-6">
            {currentStep === 'asset' && (
              <Panel padding="lg" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">1. Asset</h2>
                    <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                      Confirm the creative, campaign and preview payload before anyone signs off.
                    </p>
                  </div>
                  <Button variant="secondary" leadingIcon={<Eye />} onClick={() => setPreviewing(selectedReview)}>
                    Open preview
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <PreviewMeta label="Creative" value={selectedReview.name} />
                  <PreviewMeta label="Campaign" value={selectedReview.campaignName} />
                  <PreviewMeta label="Format" value={selectedReview.format} />
                  <PreviewMeta label="Size" value={selectedReview.size} />
                  <PreviewMeta label="Submitted by" value={selectedReview.submittedBy} />
                  <PreviewMeta label="Submitted at" value={new Date(selectedReview.submittedAt).toLocaleString()} />
                </div>
                <div className="flex justify-end border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button onClick={() => setSearchParams(new URLSearchParams({ step: 'qa' }), { replace: true })}>
                    Continue to QA
                  </Button>
                </div>
              </Panel>
            )}

            {currentStep === 'qa' && (
              <Panel padding="lg" className="space-y-4">
                <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">2. QA preview</h2>
                <p className="text-sm text-[color:var(--dusk-text-muted)]">
                  Preview exactly what traffickers will hand off. This is the operational checkpoint before sign-off.
                </p>
                <Panel className="border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-info-fg)]">
                  Check the asset against campaign, size and destination. If something looks off, reject now instead of after trafficking.
                </Panel>
                <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button variant="ghost" onClick={() => setSearchParams(new URLSearchParams({ step: 'asset' }), { replace: true })}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" leadingIcon={<Eye />} onClick={() => setPreviewing(selectedReview)}>
                      Open preview
                    </Button>
                    <Button onClick={() => setSearchParams(new URLSearchParams({ step: 'signoff' }), { replace: true })}>
                      Continue to sign-off
                    </Button>
                  </div>
                </div>
              </Panel>
            )}

            {currentStep === 'signoff' && (
              <Panel padding="lg" className="space-y-4">
                <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">3. Sign-off</h2>
                <p className="text-sm text-[color:var(--dusk-text-muted)]">
                  Approval moves the creative out of queue. Rejection notifies the submitter and keeps bad payloads out of trafficking.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" leadingIcon={<CheckCircle2 />} loading={busyIds.has(selectedReview.id)} onClick={() => void handleApprove(selectedReview)}>
                    Approve creative
                  </Button>
                  <Button variant="danger" leadingIcon={<AlertCircle />} loading={busyIds.has(selectedReview.id)} onClick={() => void handleReject(selectedReview)}>
                    Reject creative
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button variant="ghost" onClick={() => setSearchParams(new URLSearchParams({ step: 'qa' }), { replace: true })}>
                    Back
                  </Button>
                  <Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams({ step: 'traffic' }), { replace: true })}>
                    Skip to handoff
                  </Button>
                </div>
              </Panel>
            )}

            {currentStep === 'traffic' && (
              <Panel padding="lg" className="space-y-4">
                <h2 className="text-lg font-semibold text-[color:var(--dusk-text-primary)]">4. Traffic to</h2>
                {items.some((item) => item.id === selectedReview.id) ? (
                  <Panel className="border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-warning-fg)]">
                    This creative is still pending. Complete sign-off before handing it to trafficking.
                  </Panel>
                ) : (
                  <Panel className="border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-success-fg)]">
                    Review is complete. This creative is ready for trafficking handoff.
                  </Panel>
                )}
                <div className="flex items-center justify-between border-t border-[color:var(--dusk-border-subtle)] pt-4">
                  <Button variant="ghost" onClick={() => setSearchParams(new URLSearchParams({ step: 'signoff' }), { replace: true })}>
                    Back
                  </Button>
                  <Button onClick={() => navigate('/creatives/approval')}>
                    Return to queue
                  </Button>
                </div>
              </Panel>
            )}
          </div>
        </div>
      ) : items.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<CheckCircle2 />}
            kicker="All clear"
            title="No creatives waiting for review"
            description="When new creatives are submitted, they will appear here for approval."
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          rowKey={(c) => c.id}
          density="comfortable"
          onRowClick={(c) => setPreviewing(c)}
        />
      )}

      <Modal
        open={Boolean(previewing)}
        onClose={() => setPreviewing(null)}
        title={previewing?.name}
        description={previewing?.campaignName}
        size="lg"
        footer={
          previewing && (
            <>
              <Button variant="ghost" onClick={() => setPreviewing(null)}>Close</Button>
              <Button
                variant="danger"
                leadingIcon={<AlertCircle />}
                onClick={async () => {
                  const c = previewing;
                  setPreviewing(null);
                  await handleReject(c);
                }}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                leadingIcon={<CheckCircle2 />}
                onClick={async () => {
                  const c = previewing;
                  setPreviewing(null);
                  await handleApprove(c);
                }}
              >
                Approve
              </Button>
            </>
          )
        }
      >
        {previewing && (
          <div>
            <div className="rounded-lg border border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] overflow-hidden">
              <iframe
                src={previewing.previewUrl}
                title={previewing.name}
                className="h-[420px] w-full bg-[color:var(--dusk-surface-muted)]"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
              <PreviewMeta label="Format" value={previewing.format} />
              <PreviewMeta label="Size" value={previewing.size} />
              <PreviewMeta label="Submitted by" value={previewing.submittedBy} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Kicker>{label}</Kicker>
      <p className="mt-1 text-sm text-[color:var(--dusk-text-primary)]">{value}</p>
    </div>
  );
}
