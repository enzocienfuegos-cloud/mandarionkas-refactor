import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Tag as TagIcon,
  ImageIcon,
  ExternalLink,
  Code,
  FileText,
  Globe,
  Shield,
  Activity,
  Zap,
} from '../system/icons';
import { Panel, PanelHeader, Kicker, Badge, Button } from '../system';

interface ToolEntry {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  external?: boolean;
  status?: 'beta' | 'alpha' | 'new';
  category: 'creative' | 'trafficking' | 'verification' | 'utilities';
}

const TOOLS: ToolEntry[] = [
  // Creative
  {
    id: 'tag-validator',
    title: 'Tag validator',
    description: 'Paste a 3rd-party tag to inspect calls, macros, and detect blocking scripts.',
    icon: <TagIcon />,
    href: '/tools/tag-validator',
    category: 'creative',
  },
  {
    id: 'creative-tester',
    title: 'Creative tester',
    description: 'Render a creative in IAB-standard frames and DSP environments.',
    icon: <ImageIcon />,
    href: '/tools/creative-tester',
    category: 'creative',
    status: 'new',
  },
  {
    id: 'banner-studio',
    title: 'Mandarionkas Studio',
    description: 'Visual editor for HTML5 rich-media banners with click-tag instrumentation.',
    icon: <Code />,
    href: '/tools/mandarionkas',
    category: 'creative',
    status: 'beta',
  },

  // Trafficking
  {
    id: 'macro-builder',
    title: 'Macro builder',
    description: 'Compose DSP-specific click and view macros with validation.',
    icon: <Code />,
    href: '/tools/macro-builder',
    category: 'trafficking',
  },
  {
    id: 'tag-generator',
    title: 'Tag generator',
    description: 'Generate Adform DHTML, MRAID, CM360 and clickTag wrappers from a single source.',
    icon: <FileText />,
    href: '/tools/tag-generator',
    category: 'trafficking',
  },

  // Verification
  {
    id: 'pixel-tester',
    title: 'Pixel tester',
    description: 'Fire test impressions and verify pixel beacons reach IAS, Moat and DV.',
    icon: <Activity />,
    href: '/tools/pixel-tester',
    category: 'verification',
  },
  {
    id: 'brand-safety',
    title: 'Brand safety scan',
    description: 'Pre-flight check of placement domains against blocklists.',
    icon: <Shield />,
    href: '/tools/brand-safety',
    category: 'verification',
    status: 'beta',
  },

  // Utilities
  {
    id: 'preview-bookmarklet',
    title: 'Preview bookmarklet',
    description: 'Drag to bookmarks bar to preview live tags on any page.',
    icon: <Globe />,
    href: 'javascript:void(0)',
    category: 'utilities',
  },
  {
    id: 'bulk-export',
    title: 'Bulk export',
    description: 'Export campaigns, tags, creatives and metrics as CSV or XLSX.',
    icon: <FileText />,
    href: '/tools/export',
    category: 'utilities',
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
  { id: 'creative',     label: 'Creative',     description: 'Build, validate, and inspect creative assets.' },
  { id: 'trafficking',  label: 'Trafficking',  description: 'Wrappers, macros, and tag generation.' },
  { id: 'verification', label: 'Verification', description: 'Make sure ads serve, render, and report correctly.' },
  { id: 'utilities',    label: 'Utilities',    description: 'Helper tools that don\'t fit elsewhere.' },
];

/**
 * Tools — refactored to the design system (S57).
 *
 * A hub of internal utilities. Each tool is a card in a category.
 * Clicking a card either navigates to a sub-route or opens external.
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
    if (tool.external || tool.href.startsWith('http')) {
      window.open(tool.href, '_blank', 'noopener');
    } else if (tool.href.startsWith('javascript:')) {
      // Bookmarklet — do nothing
    } else {
      navigate(tool.href);
    }
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
            {tool.external && (
              <ExternalLink className="h-3 w-3 text-[color:var(--dusk-text-soft)] ml-auto" />
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
