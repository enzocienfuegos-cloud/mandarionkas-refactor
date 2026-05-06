import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Activity,
  LinkIcon,
  Tag as TagIcon,
  Gauge,
  Code,
  ArrowRight,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Badge,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  CenteredSpinner,
  EmptyState,
  useToast,
} from '../system';

interface TagSummary {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  campaignName?: string;
  size?: string;
  format?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
}

/**
 * Tag builder — refactored to the Dusk design system (S56).
 *
 * Three tabs (replaces the old emoji-led toolbar):
 *   - Setup     ⟶ name, format, dimensions, click/view macros
 *   - Activity  ⟶ delivery + diagnostics
 *   - Tracking  ⟶ pixels, third-party verification, viewability
 */
export default function TagBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = Boolean(id && id !== 'new');

  const [tag, setTag]         = useState<TagSummary | null>(null);
  const [tab, setTab]         = useState<'setup' | 'activity' | 'tracking'>('setup');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    name: '',
    format: 'display',
    width: '300',
    height: '250',
    clickMacro: '',
    viewMacro: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fetch(`/v1/tags/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const t = data?.tag ?? data;
        setTag(t);
        setForm({
          name: t.name ?? '',
          format: t.format ?? 'display',
          width:  t.size?.split('x')[0] ?? '300',
          height: t.size?.split('x')[1] ?? '250',
          clickMacro: t.clickMacro ?? '',
          viewMacro:  t.viewMacro ?? '',
        });
      })
      .catch(() => toast({ tone: 'critical', title: 'Failed to load tag' }))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const set = (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: event.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const url    = isEdit ? `/v1/tags/${id}` : '/v1/tags';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          format: form.format,
          size: `${form.width}x${form.height}`,
          clickMacro: form.clickMacro,
          viewMacro: form.viewMacro,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ tone: 'success', title: isEdit ? 'Tag updated' : 'Tag created' });
      navigate('/tags');
    } catch {
      toast({ tone: 'critical', title: 'Could not save tag' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CenteredSpinner label="Loading tag…" />;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Kicker>{isEdit ? 'Edit tag' : 'New tag'}</Kicker>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            {tag?.name ?? form.name ?? 'Untitled tag'}
          </h1>
          {tag?.campaignName && (
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
              In campaign{' '}
              <span className="text-[color:var(--dusk-text-secondary)] font-medium">{tag.campaignName}</span>
            </p>
          )}
        </div>
        {tag?.status && (
          <Badge tone={tag.status === 'active' ? 'success' : tag.status === 'paused' ? 'warning' : 'neutral'} dot>
            {tag.status}
          </Badge>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList aria-label="Tag sections">
          <Tab value="setup"    leadingIcon={<TagIcon className="h-4 w-4" />}>Setup</Tab>
          <Tab value="activity" leadingIcon={<Activity className="h-4 w-4" />}>Activity</Tab>
          <Tab value="tracking" leadingIcon={<LinkIcon className="h-4 w-4" />}>Tracking</Tab>
        </TabsList>

        <TabPanel value="setup">
          <Panel padding="lg">
            <PanelHeader title="Setup" subtitle="Identification, format and dimensions" />
            <div className="space-y-5">
              <FormField label="Tag name" required>
                <Input value={form.name} onChange={set('name')} />
              </FormField>
              <div className="grid gap-5 md:grid-cols-3">
                <FormField label="Format">
                  <Select
                    value={form.format}
                    onChange={set('format')}
                    options={[
                      { value: 'display', label: 'Display' },
                      { value: 'video',   label: 'Video' },
                      { value: 'native',  label: 'Native' },
                      { value: 'rich',    label: 'Rich media' },
                    ]}
                  />
                </FormField>
                <FormField label="Width (px)">
                  <Input type="number" value={form.width} onChange={set('width')} />
                </FormField>
                <FormField label="Height (px)">
                  <Input type="number" value={form.height} onChange={set('height')} />
                </FormField>
              </div>
            </div>
          </Panel>

          <Panel padding="lg" className="mt-4">
            <PanelHeader title="DSP macros" subtitle="Click and view tracking inserted into the served tag" />
            <div className="space-y-5">
              <FormField label="Click macro" helper="DSP-specific click tracker, e.g. ${CLICK_URL_ESC}">
                <Input value={form.clickMacro} onChange={set('clickMacro')} className="font-mono" />
              </FormField>
              <FormField label="View / impression macro">
                <Input value={form.viewMacro} onChange={set('viewMacro')} className="font-mono" />
              </FormField>
            </div>
          </Panel>
        </TabPanel>

        <TabPanel value="activity">
          <Panel padding="lg">
            <PanelHeader
              title="Delivery"
              subtitle="Last 7 days"
              kicker={<span className="inline-flex items-center gap-1.5"><BarChart3 className="h-3 w-3" />Activity</span>}
            />
            {tag && tag.impressions != null ? (
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Impressions" value={tag.impressions.toLocaleString()} />
                <Stat label="Clicks" value={tag.clicks?.toLocaleString() ?? '0'} />
                <Stat label="CTR" value={tag.ctr != null ? `${(tag.ctr * 100).toFixed(2)}%` : '—'} />
              </div>
            ) : (
              <EmptyState
                icon={<BarChart3 />}
                title="No activity yet"
                description="Once the tag starts serving, delivery metrics will appear here."
              />
            )}
          </Panel>
        </TabPanel>

        <TabPanel value="tracking">
          <Panel padding="lg">
            <PanelHeader title="Tracking" subtitle="Pixels and third-party verification" />
            <EmptyState
              icon={<LinkIcon />}
              title="No third-party trackers"
              description="Add IAS, Moat or DV pixels to enable viewability and brand-safety metrics."
              action={<Button variant="secondary">Add pixel</Button>}
            />
          </Panel>
        </TabPanel>
      </Tabs>

      {/* More tools for this tag — only when editing an existing tag */}
      {isEdit && id && (
        <Panel padding="lg" className="mt-4">
          <PanelHeader
            title="More for this tag"
            subtitle="Dedicated dashboards for delivery health, pixels, tracking and reporting"
          />
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <ToolLink
              icon={<Gauge />}
              title="Health"
              description="Live delivery and serving signals"
              onClick={() => navigate(`/tags/${id}/health`)}
            />
            <ToolLink
              icon={<Code />}
              title="Pixels"
              description="Manage 3rd-party pixels for this tag"
              onClick={() => navigate(`/tags/${id}/pixels`)}
            />
            <ToolLink
              icon={<LinkIcon />}
              title="Tracking"
              description="Click and view tracking configuration"
              onClick={() => navigate(`/tags/${id}/tracking`)}
            />
            <ToolLink
              icon={<BarChart3 />}
              title="Reporting"
              description="Performance reports for this tag"
              onClick={() => navigate(`/tags/${id}/reporting`)}
            />
          </div>
        </Panel>
      )}

      <div
        className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-surface-1 border-t border-[color:var(--dusk-border-default)] backdrop-blur-xl"
        style={{ boxShadow: '0 -8px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate('/tags')}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {isEdit ? 'Update tag' : 'Create tag'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Kicker>{label}</Kicker>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular text-[color:var(--dusk-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function ToolLink({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group text-left p-3 rounded-xl border bg-surface-1
        border-[color:var(--dusk-border-default)]
        hover:border-brand-500 hover:shadow-2 transition-all
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            shrink-0 h-9 w-9 rounded-lg flex items-center justify-center
            bg-surface-muted text-text-secondary
            group-hover:bg-brand-50 group-hover:text-text-brand transition-colors
            [&>svg]:h-4 [&>svg]:w-4
          "
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[color:var(--dusk-text-primary)]">
              {title}
            </h3>
            <ArrowRight className="h-3.5 w-3.5 text-[color:var(--dusk-text-soft)] group-hover:text-text-brand group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-muted)] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
