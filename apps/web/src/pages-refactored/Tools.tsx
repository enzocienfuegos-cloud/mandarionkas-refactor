import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Wrench,
  Tag as TagIcon,
  Code,
  Zap,
  CheckCircle2,
  Target,
} from '../system/icons';
import { Panel, PanelHeader, Kicker, Badge, Button } from '../system';

interface ToolEntry {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  status?: 'beta' | 'alpha' | 'new';
  category: 'trafficking' | 'verification' | 'utilities';
}

const TOOLS: ToolEntry[] = [
  {
    id: 'macro-builder',
    title: 'Macro builder',
    description: 'Compose DSP-specific click and view macros with validation.',
    icon: <Code />,
    href: '/tools/macro-builder',
    category: 'trafficking',
  },
  {
    id: 'pixel-tester',
    title: 'Tag validator',
    description: 'Paste a third-party tag to inspect wrappers, macros, blocking scripts and request chains.',
    icon: <TagIcon />,
    href: '/tools/tag-validator',
    category: 'verification',
  },
  {
    id: 'vast-validator',
    title: 'VAST validator',
    description: 'Validate VAST XML before trafficking it to a DSP, SSP, or player.',
    icon: <CheckCircle2 />,
    href: '/tools/vast-validator',
    category: 'verification',
  },
  {
    id: 'chain-validator',
    title: 'Chain validator',
    description: 'Inspect wrapper hops, catch dead ends and identify broken redirect chains before launch.',
    icon: <Target />,
    href: '/tools/chain-validator',
    category: 'verification',
  },

  {
    id: 'webhook-tester',
    title: 'Webhook tester',
    description: 'Inspect webhook payloads and replay events against your endpoint.',
    icon: <Zap />,
    href: '/tools/webhook-tester',
    category: 'utilities',
    status: 'alpha',
  },
];

const CATEGORIES: { id: ToolEntry['category']; label: string; description: string }[] = [
  { id: 'trafficking',  label: 'Trafficking',  description: 'Wrappers, macros, and tag generation.' },
  { id: 'verification', label: 'Verification', description: 'Validate tags, VAST payloads and wrapper chains before launch.' },
  { id: 'utilities',    label: 'Utilities',    description: 'Helper tools that don\'t fit elsewhere.' },
];

/**
 * Tools — refactored to the design system (S57).
 *
 * A hub of real, routed utilities only. No placeholder tools, no dead links.
 */
export default function Tools() {
  const totalTools = TOOLS.length;
  const verificationCount = TOOLS.filter((tool) => tool.category === 'verification').length;
  const traffickingCount = TOOLS.filter((tool) => tool.category === 'trafficking').length;
  const utilitiesCount = TOOLS.filter((tool) => tool.category === 'utilities').length;

  return (
    <div className="space-y-6">
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)] lg:items-end">
        <div>
          <Kicker>Platform</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Tools
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--dusk-text-muted)]">
            Operational utilities for preflight validation, trafficking setup, and delivery debugging. Every entry below routes to a real working tool.
          </p>
        </div>

        <Panel padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Kicker>Recommended path</Kicker>
              <p className="mt-2 text-sm font-medium text-[color:var(--dusk-text-primary)]">
                Start with verification before launch.
              </p>
              <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
                Validate tags, VAST payloads, and wrapper chains before handing off to trafficking or QA.
              </p>
            </div>
            <Badge tone="brand" variant="soft">
              {verificationCount} checks
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <QuickLink href="/tools/tag-validator" label="Validate tag" />
            <QuickLink href="/tools/vast-validator" label="Check VAST" />
            <QuickLink href="/tools/chain-validator" label="Inspect chain" />
          </div>
        </Panel>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Live tools" value={String(totalTools)} helper="all routes active" />
        <SummaryCard label="Verification" value={String(verificationCount)} helper="preflight & QA" tone="info" />
        <SummaryCard label="Trafficking" value={String(traffickingCount)} helper="macro setup" tone="brand" />
        <SummaryCard label="Utilities" value={String(utilitiesCount)} helper="endpoint diagnostics" tone="warning" />
      </div>

      {CATEGORIES.map((category) => {
        const items = TOOLS.filter((t) => t.category === category.id);
        if (items.length === 0) return null;
        return (
          <Panel key={category.id} padding="lg">
            <PanelHeader title={category.label} subtitle={category.description} />
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolEntry }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(tool.href);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="
        group text-left p-4 rounded-2xl border bg-surface-1
        border-[color:var(--dusk-border-default)]
        hover:border-brand-500 hover:shadow-2 transition-all
      "
    >
      <div className="flex items-start gap-3">
        <div
          className="
            shrink-0 h-10 w-10 rounded-xl flex items-center justify-center
            bg-surface-muted text-text-secondary
            group-hover:bg-brand-50 group-hover:text-text-brand transition-colors
            [&>svg]:h-5 [&>svg]:w-5
          "
          aria-hidden
        >
          {tool.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm text-[color:var(--dusk-text-primary)]">
              {tool.title}
            </h3>
            {tool.status && (
              <Badge
                tone={tool.status === 'new' ? 'brand' : tool.status === 'beta' ? 'info' : 'warning'}
                size="sm"
                variant="outline"
              >
                {tool.status}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)] leading-relaxed">
            {tool.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-[color:var(--dusk-text-secondary)]">Open tool</span>
            <ArrowRight className="h-4 w-4 text-[color:var(--dusk-brand-500)] transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: 'neutral' | 'brand' | 'info' | 'warning';
}) {
  return (
    <Panel padding="md">
      <div className="flex items-start justify-between gap-3">
        <Kicker>{label}</Kicker>
        <Badge tone={tone} size="sm" variant="outline">
          {value}
        </Badge>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">{value}</div>
      <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">{helper}</p>
    </Panel>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  const navigate = useNavigate();

  return (
    <Button type="button" variant="secondary" size="sm" onClick={() => navigate(href)}>
      {label}
    </Button>
  );
}
