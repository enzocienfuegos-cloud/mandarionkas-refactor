import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Tag as TagIcon,
  Code,
  Zap,
  CheckCircle2,
  Target,
} from '../system/icons';
import { Panel, PanelHeader, Kicker, Badge } from '../system';

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
  return (
    <div className="space-y-6">
      <header>
        <Kicker>Platform</Kicker>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
          Tools
        </h1>
        <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
          Standalone utilities for ad-ops, trafficking, and verification.
        </p>
      </header>

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
        </div>
      </div>
    </button>
  );
}
