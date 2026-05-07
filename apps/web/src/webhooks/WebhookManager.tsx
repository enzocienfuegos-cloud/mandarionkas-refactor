import React, { FormEvent, useState } from 'react';
import { Badge, Button, CenteredSpinner, DataTable, EmptyState, FormField, Input, Modal, PageHeader, Panel, Select, useConfirm, useToast, type ColumnDef } from '../system';
import { Bell, Plus, RefreshCw } from '../system/icons';
import { useWebhookData, useWebhookForm, type DeliveryRecord, type WebhookRecord } from './hooks';

const ALL_EVENTS = [
  'tag.impression',
  'tag.click',
  'creative.approved',
  'creative.rejected',
  'campaign.started',
  'campaign.completed',
  'pacing.behind',
  'discrepancy.critical',
];

const statusBadge = (status: WebhookRecord['status']) => (
  <Badge tone={status === 'active' ? 'success' : 'neutral'} size="sm">
    {status === 'active' ? 'Active' : 'Inactive'}
  </Badge>
);

const deliveryBadge = (status: DeliveryRecord['status']) => {
  const cfg: Record<DeliveryRecord['status'], string> = {
    success: 'bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]',
    failed:  'bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]',
    pending: 'bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cfg[status]}`}>
      {status}
    </span>
  );
};

export default function WebhookManager() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const {
    webhooks,
    setWebhooks,
    loading,
    error,
    selectedWebhookId,
    setSelectedWebhookId,
    deliveries,
    setDeliveries,
    loadingDeliveries,
    load,
    loadDeliveries,
  } = useWebhookData();
  const {
    showModal,
    setShowModal,
    editingWebhook,
    form,
    setForm,
    creating,
    setCreating,
    formError,
    setFormError,
    openNewModal,
    openEditModal,
    toggleEvent,
    generateSecret,
  } = useWebhookForm();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (!form.url.trim()) { setFormError('URL is required.'); return; }
    if (form.events.size === 0) { setFormError('Select at least one event.'); return; }

    const body: {
      name: string;
      url: string;
      events: string[];
      secret?: string;
      status: WebhookRecord['status'];
    } = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: Array.from(form.events),
      secret: form.secret || undefined,
      status: form.status,
    };

    setCreating(true);
    try {
      const url = editingWebhook ? `/v1/webhooks/${editingWebhook.id}` : '/v1/webhooks';
      const method = editingWebhook ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message ?? 'Save failed');
      }
      const data = await res.json();
      if (editingWebhook) {
        setWebhooks((current) => current.map((webhook) => webhook.id === editingWebhook.id ? data : webhook));
      } else {
        setWebhooks((current) => [data, ...current]);
      }
      setShowModal(false);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (wh: WebhookRecord) => {
    const confirmed = await confirm({
      title: `Delete webhook "${wh.name}"?`,
      description: 'This endpoint will stop receiving workspace events immediately.',
      tone: 'danger',
      confirmLabel: 'Delete',
      requireTypeToConfirm: wh.name,
    });
    if (!confirmed) return;
    setDeletingId(wh.id);
    try {
      const res = await fetch(`/v1/webhooks/${wh.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
      setWebhooks((current) => current.filter((webhook) => webhook.id !== wh.id));
      if (selectedWebhookId === wh.id) { setSelectedWebhookId(null); setDeliveries([]); }
      toast({ tone: 'warning', title: `Webhook "${wh.name}" deleted` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to delete webhook.' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (wh: WebhookRecord) => {
    const newStatus = wh.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/v1/webhooks/${wh.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Update failed');
      setWebhooks((current) => current.map((webhook) => webhook.id === wh.id ? { ...webhook, status: newStatus } : webhook));
      toast({ tone: 'success', title: `Webhook ${newStatus === 'active' ? 'activated' : 'paused'}` });
    } catch {
      toast({ tone: 'critical', title: 'Failed to update webhook status.' });
    }
  };

  const webhookColumns: ColumnDef<WebhookRecord>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (wh) => wh.name,
      sortAccessor: (wh) => wh.name,
    },
    {
      id: 'url',
      header: 'URL',
      cell: (wh) => <span className="font-mono text-xs text-text-muted">{wh.url}</span>,
      sortAccessor: (wh) => wh.url,
    },
    {
      id: 'events',
      header: 'Events',
      cell: (wh) => wh.events.join(', '),
      sortAccessor: (wh) => wh.events.join(', '),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (wh) => statusBadge(wh.status),
      sortAccessor: (wh) => wh.status,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (wh) => (
        <div className="flex gap-1">
          <Button onClick={() => void handleToggleStatus(wh)} size="sm" variant="ghost">
            {wh.status === 'active' ? 'Disable' : 'Enable'}
          </Button>
          <Button onClick={() => openEditModal(wh)} size="sm" variant="secondary">
            Edit
          </Button>
          <Button onClick={() => void handleDelete(wh)} disabled={deletingId === wh.id} size="sm" variant="danger">
            {deletingId === wh.id ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      ),
    },
  ];

  const deliveryColumns: ColumnDef<DeliveryRecord>[] = [
    {
      id: 'event',
      header: 'Event',
      cell: (delivery) => <code className="text-xs font-mono text-text-muted">{delivery.event}</code>,
      sortAccessor: (delivery) => delivery.event,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (delivery) => deliveryBadge(delivery.status),
      sortAccessor: (delivery) => delivery.status,
    },
    {
      id: 'sentAt',
      header: 'Sent',
      cell: (delivery) => new Date(delivery.sentAt).toLocaleString(),
      sortAccessor: (delivery) => delivery.sentAt,
    },
    {
      id: 'response',
      header: 'Response',
      cell: (delivery) => [delivery.statusCode, delivery.responseTime ? `${delivery.responseTime}ms` : null].filter(Boolean).join(' · ') || '—',
      sortAccessor: (delivery) => `${delivery.statusCode ?? ''}${delivery.responseTime ?? ''}`,
    },
  ];

  if (loading) {
    return <CenteredSpinner label="Loading webhooks…" />;
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        meta="Receive HTTP notifications for workspace events."
        secondaryActions={(
          <div className="flex items-center gap-2">
            <Button onClick={load} variant="secondary" size="sm" leadingIcon={<RefreshCw />}>Refresh</Button>
            <Button onClick={openNewModal} variant="primary" size="sm" leadingIcon={<Plus />}>New Webhook</Button>
          </div>
        )}
      />

      {error && (
        <div className="mb-4 px-4 py-3 bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)] rounded-lg text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</div>
      )}

      {webhooks.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<Bell />}
            title="No webhooks configured"
            description="Create a webhook to receive event notifications."
            action={<Button onClick={openNewModal} variant="primary" leadingIcon={<Plus />}>New Webhook</Button>}
          />
        </Panel>
      ) : (
        <div className="flex gap-6">
          {/* Webhook list */}
          <div className="flex-1 min-w-0">
            <DataTable
              columns={webhookColumns}
              data={webhooks}
              rowKey={(wh) => wh.id}
              onRowClick={(wh) => loadDeliveries(wh.id)}
            />
          </div>

          {/* Delivery history panel */}
          {selectedWebhookId && (
            <div className="basis-[18rem] flex-shrink-0">
              <div className="overflow-hidden rounded-xl border border-border-default bg-surface-1">
                <div className="px-4 py-3 border-b border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)]">
                  <h3 className="text-sm font-semibold text-text-secondary">Delivery History</h3>
                </div>
                {loadingDeliveries ? (
                  <CenteredSpinner label="Loading deliveries…" />
                ) : deliveries.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-[color:var(--dusk-text-soft)]">No deliveries recorded yet. Trigger a matching event to verify this endpoint is receiving traffic.</div>
                ) : (
                  <DataTable
                    columns={deliveryColumns}
                    data={deliveries}
                    rowKey={(delivery) => delivery.id}
                    bordered={false}
                    density="compact"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingWebhook ? 'Edit Webhook' : 'New Webhook'}
        description="Configure workspace delivery notifications."
        size="lg"
        footer={
          <div className="flex w-full gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" form="webhook-form" loading={creating} className="flex-1">
              {editingWebhook ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </div>
        }
      >
        {formError && (
          <Panel className="mb-4 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
            {formError}
          </Panel>
        )}
        <form id="webhook-form" onSubmit={handleSubmit} className="space-y-5">
          <FormField label="Name" required>
            <Input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Production Webhook"
            />
          </FormField>

          <FormField label="Endpoint URL" required>
            <Input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://your-app.com/webhooks/smx"
            />
          </FormField>

          <FormField label="Events" required>
            <div className="space-y-2 rounded-lg border border-border-default p-3">
              {ALL_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.events.has(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="h-4 w-4 rounded border-border-strong text-text-brand focus:ring-brand-500"
                  />
                  <code className="text-xs font-mono text-text-secondary">{ev}</code>
                </label>
              ))}
            </div>
          </FormField>

          <FormField label="Signing Secret" helper="Used to verify webhook payloads via HMAC-SHA256 signature.">
            <div className="flex gap-2">
              <Input
                type="text"
                value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                className="flex-1 font-mono"
                placeholder="whsec_..."
              />
              <Button type="button" variant="secondary" onClick={() => setForm(f => ({ ...f, secret: generateSecret() }))}>
                Generate
              </Button>
            </div>
          </FormField>

          <FormField label="Status">
            <Select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as WebhookRecord['status'] }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
