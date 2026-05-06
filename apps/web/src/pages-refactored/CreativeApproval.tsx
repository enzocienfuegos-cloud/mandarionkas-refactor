import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Eye, Calendar } from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Badge,
  Kicker,
  Modal,
  CenteredSpinner,
  EmptyState,
  DataTable,
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

/**
 * Creative approval queue — refactored to the Dusk design system (S56).
 *
 * - Uses Modal primitive for the preview lightbox (focus trap, ESC).
 * - Uses Button variant="danger" / "primary" instead of bg-red-600 / bg-green-600.
 * - Uses useConfirm() to gate destructive rejection with a typed reason.
 * - Uses useToast() for in-flight feedback.
 */
export default function CreativeApproval() {
  const { toast } = useToast();
  const confirm   = useConfirm();

  const [items, setItems]       = useState<CreativeReview[]>([]);
  const [loading, setLoading]   = useState(true);
  const [previewing, setPreviewing] = useState<CreativeReview | null>(null);
  const [busyIds, setBusyIds]       = useState<Set<string>>(new Set());

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

  return (
    <div className="max-w-content mx-auto pb-12">
      <header className="dusk-page-header">
        <div>
          <Kicker>Approval queue</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Creatives pending review
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Approve or reject creatives before they go live to bidders.
          </p>
        </div>
        <Badge tone="info" size="md">{items.length} pending</Badge>
      </header>

      {loading ? (
        <CenteredSpinner label="Loading creatives…" />
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
                className="w-full h-[420px] bg-white"
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
