import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Building2,
  Users,
  Megaphone,
  ExternalLink,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  Badge,
  Kicker,
  MetricCard,
  Modal,
  FormField,
  DataTable,
  type ColumnDef,
  EmptyState,
  useToast,
  useConfirm,
} from '../system';

type ClientStatus = 'active' | 'paused' | 'archived';

interface Client {
  id: string;
  name: string;
  industry: string;
  status: ClientStatus;
  contactEmail: string;
  campaignCount: number;
  totalSpend: number;
  lastActivityAt: string | null;
}

const STATUS_TONE: Record<ClientStatus, 'success' | 'warning' | 'neutral'> = {
  active:   'success',
  paused:   'warning',
  archived: 'neutral',
};

/**
 * Clients — refactored to the design system (S57).
 *
 * Workspace-level client management: a list of brands/agencies that
 * own campaigns inside the workspace. CRUD via inline modal.
 */
export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm   = useConfirm();

  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('active');
  const [editing, setEditing]   = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch('/v1/clients', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setClients(data?.items ?? []))
      .catch(() => toast({ tone: 'critical', title: 'Could not load clients' }))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search) {
        const haystack = `${c.name} ${c.industry} ${c.contactEmail}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [clients, search, statusFilter]);

  const summary = useMemo(() => {
    const active = clients.filter((c) => c.status === 'active').length;
    const totalCampaigns = clients.reduce((sum, c) => sum + c.campaignCount, 0);
    const totalSpend = clients.reduce((sum, c) => sum + c.totalSpend, 0);
    return { active, totalCampaigns, totalSpend };
  }, [clients]);

  const handleArchive = async (client: Client) => {
    const ok = await confirm({
      title: 'Archive this client?',
      description: `"${client.name}" will be hidden from the default view. Existing campaigns will not be affected.`,
      tone: 'danger',
      confirmLabel: 'Archive',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/v1/clients/${client.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) throw new Error('failed');
      setClients((current) =>
        current.map((c) => (c.id === client.id ? { ...c, status: 'archived' as const } : c)),
      );
      toast({ tone: 'warning', title: 'Client archived' });
    } catch {
      toast({ tone: 'critical', title: 'Could not archive client' });
    }
  };

  const columns: ColumnDef<Client>[] = [
    {
      id: 'name',
      header: 'Client',
      width: '32%',
      sortAccessor: (row) => row.name,
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold text-text-inverse"
            style={{ background: 'var(--dusk-brand-gradient)' }}
            aria-hidden
          >
            {row.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.name}</p>
            <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">{row.industry}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (row) => row.status,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]} dot>{row.status}</Badge>,
    },
    {
      id: 'campaigns',
      header: 'Campaigns',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.campaignCount,
      cell: (row) => row.campaignCount,
    },
    {
      id: 'spend',
      header: 'Total spend',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.totalSpend,
      cell: (row) =>
        new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(row.totalSpend),
    },
    {
      id: 'activity',
      header: 'Last activity',
      sortAccessor: (row) => row.lastActivityAt ?? '',
      cell: (row) =>
        row.lastActivityAt ? (
          <span className="text-xs text-[color:var(--dusk-text-muted)]">
            {new Date(row.lastActivityAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-[color:var(--dusk-text-soft)]">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Megaphone />}
            onClick={(e) => { e.stopPropagation(); navigate(`/campaigns?clientId=${row.id}`); }}
          >
            Campaigns
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditing(row); }}>
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Platform</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Clients
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Brands and agencies you traffic for in this workspace.
          </p>
        </div>
        <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreating(true)}>
          New client
        </Button>
      </header>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <MetricCard
          label="Active clients"
          value={summary.active}
          tone="success"
          icon={<Building2 />}
          loading={loading}
        />
        <MetricCard
          label="Total campaigns"
          value={summary.totalCampaigns}
          tone="info"
          icon={<Megaphone />}
          loading={loading}
        />
        <MetricCard
          label="Lifetime spend"
          value={new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(summary.totalSpend)}
          tone="brand"
          loading={loading}
        />
      </div>

      <Panel padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            inputSize="md"
            leadingIcon={<Search />}
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
            fullWidth={false}
          />
          <Select
            selectSize="md"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            fullWidth={false}
            className="min-w-[160px]"
            options={[
              { value: 'all',      label: 'All clients' },
              { value: 'active',   label: 'Active only' },
              { value: 'paused',   label: 'Paused' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </Panel>

      {!loading && filtered.length === 0 ? (
        <Panel padding="none">
          <EmptyState
            icon={<Users />}
            title={search ? 'No clients match your search' : 'No clients yet'}
            description={
              search
                ? 'Try a different name or industry.'
                : 'Add your first client to start running campaigns.'
            }
            action={
              search ? (
                <Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>
              ) : (
                <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreating(true)}>
                  New client
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(c) => c.id}
          loading={loading}
          density="comfortable"
          onRowClick={(c) => setEditing(c)}
        />
      )}

      <ClientEditor
        client={editing}
        creating={creating}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { setEditing(null); setCreating(false); load(); }}
        onArchive={editing ? (() => { handleArchive(editing); setEditing(null); }) : undefined}
      />
    </div>
  );
}

interface ClientEditorProps {
  client: Client | null;
  creating: boolean;
  onClose: () => void;
  onSaved: () => void;
  onArchive?: () => void;
}

function ClientEditor({ client, creating, onClose, onSaved, onArchive }: ClientEditorProps) {
  const { toast } = useToast();
  const open = creating || Boolean(client);

  const [form, setForm] = useState({
    name: '',
    industry: '',
    contactEmail: '',
    status: 'active' as ClientStatus,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        industry: client.industry,
        contactEmail: client.contactEmail,
        status: client.status,
      });
    } else if (creating) {
      setForm({ name: '', industry: '', contactEmail: '', status: 'active' });
    }
  }, [client, creating]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const url    = client ? `/v1/clients/${client.id}` : '/v1/clients';
      const method = client ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('failed');
      toast({ tone: 'success', title: client ? 'Client updated' : 'Client created' });
      onSaved();
    } catch {
      toast({ tone: 'critical', title: 'Could not save client' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      description={client ? 'Update workspace-level information for this client.' : 'Add a new client to this workspace.'}
      size="md"
      footer={
        <>
          {client && onArchive && client.status !== 'archived' && (
            <Button variant="ghost" onClick={onArchive} className="mr-auto">
              Archive
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {client ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Client name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Industry">
          <Select
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            options={[
              { value: '',           label: 'Select an industry…' },
              { value: 'cpg',        label: 'CPG / FMCG' },
              { value: 'finance',    label: 'Finance' },
              { value: 'retail',     label: 'Retail' },
              { value: 'auto',       label: 'Automotive' },
              { value: 'tech',       label: 'Technology' },
              { value: 'pharma',     label: 'Pharma' },
              { value: 'travel',     label: 'Travel' },
              { value: 'other',      label: 'Other' },
            ]}
          />
        </FormField>
        <FormField label="Primary contact email" helper="Used for approvals and pacing alerts">
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
          />
        </FormField>
        <FormField label="Status">
          <Select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClientStatus }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </FormField>
      </div>
    </Modal>
  );
}
