import { useMemo, useState } from 'react';
import { Tabs } from '../../shared/ui/Tabs';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { ClientWorkspace } from '../types';
import type { WorkspaceProjectItem } from './WorkspaceProjectViews';
import {
  formatCanvas,
  resolveBannerFormatLabel,
  resolveBannerRuntime,
  resolveStatusKey,
  resolveStatusLabel,
  resolveThumbVariant,
  resolveWeightEstimate,
} from './production-helpers';
import { formatRelativeTime } from './WorkspaceProjectViews';

type InspectorTab = 'props' | 'export' | 'history';

type ClientWorkspaceInspectorProps = {
  activeClient?: ClientWorkspace;
  project?: WorkspaceProjectItem;
  onOpenProject(projectId: string): void;
  collapsed: boolean;
  onToggleCollapsed(): void;
};

function ProjectPreview({ project }: { project: WorkspaceProjectItem }): JSX.Element {
  return (
    <div className={`client-workspace-inspector__preview client-workspace-inspector__preview--${resolveThumbVariant(project)}`.trim()}>
      <div className="client-workspace-inspector__preview-frame">
        <span>{formatCanvas(project)}</span>
        <small>{resolveBannerFormatLabel(project)}</small>
      </div>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="client-workspace-inspector__row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ClientWorkspaceInspector({
  activeClient,
  project,
  onOpenProject,
  collapsed,
  onToggleCollapsed,
}: ClientWorkspaceInspectorProps): JSX.Element {
  const [tab, setTab] = useState<InspectorTab>('props');

  const palette = useMemo(
    () =>
      Array.from(
        new Set(
          [
            activeClient?.brandColor,
            activeClient?.brands?.[0]?.primaryColor,
            activeClient?.brands?.[0]?.secondaryColor,
            activeClient?.brands?.[0]?.accentColor,
          ].filter((value): value is string => Boolean(value)),
        ),
      ).slice(0, 4),
    [activeClient],
  );

  const historyItems = useMemo(() => {
    if (!project) return [];
    return [
      {
        id: `${project.id}:updated`,
        label: 'Last updated',
        detail: `${formatRelativeTime(project.updatedAt)} by ${project.ownerName ?? project.ownerUserId}`,
      },
      {
        id: `${project.id}:status`,
        label: 'Workflow status',
        detail: resolveStatusLabel(resolveStatusKey(project)),
      },
      {
        id: `${project.id}:brand`,
        label: 'Brand context',
        detail: project.brandName ?? activeClient?.name ?? 'No brand assigned',
      },
    ];
  }, [activeClient?.name, project]);

  const overviewItems = useMemo(
    () => [
      {
        id: 'client',
        label: 'Client',
        detail: activeClient?.name ?? 'No active client',
      },
      {
        id: 'members',
        label: 'Members',
        detail: `${activeClient?.memberUserIds?.length ?? activeClient?.members?.length ?? 0} active users`,
      },
      {
        id: 'brandkits',
        label: 'Brand kits',
        detail: `${activeClient?.brands?.length ?? 0} available in client hub`,
      },
    ],
    [activeClient],
  );

  if (collapsed) {
    return (
      <aside className="client-workspace-inspector client-workspace-inspector--collapsed panel">
        <div className="client-workspace-inspector__collapsed-actions">
          <button
            type="button"
            className="client-workspace-inspector__collapse-toggle"
            aria-label="Expand inspector"
            onClick={onToggleCollapsed}
          >
            <StudioIcon icon={StudioIcons.panelRightOpen} size={16} />
          </button>
          {(['props', 'export', 'history'] as const).map((tabId) => (
            <button
              key={tabId}
              type="button"
              className={`client-workspace-inspector__collapsed-tab ${tab === tabId ? 'is-active' : ''}`.trim()}
              onClick={() => {
                setTab(tabId);
                onToggleCollapsed();
              }}
            >
              {tabId.slice(0, 1).toUpperCase()}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="client-workspace-inspector panel">
      <div className="client-workspace-inspector__topbar">
        <span className="ws-sidebar-kicker">Inspector</span>
        <button
          type="button"
          className="client-workspace-inspector__collapse-toggle"
          aria-label="Collapse inspector"
          onClick={onToggleCollapsed}
        >
          <StudioIcon icon={StudioIcons.panelRightOpen} size={16} />
        </button>
      </div>
      <Tabs
        tabs={[
          { id: 'props', label: 'Props' },
          { id: 'export', label: 'Export' },
          { id: 'history', label: 'History' },
        ]}
        activeId={tab}
        onChange={setTab}
        ariaLabel="Project workspace inspector"
        className="client-workspace-inspector__tabs"
      />

      <div className="client-workspace-inspector__body">
        {project ? (
          <>
            <ProjectPreview project={project} />
            <div className="client-workspace-inspector__header">
              <h3>{project.name}</h3>
              <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? 'Unfiled banners'}</p>
            </div>

            {tab === 'props' ? (
              <div className="client-workspace-inspector__stack">
                <InspectorRow label="Size" value={formatCanvas(project)} />
                <InspectorRow label="Format" value={resolveBannerFormatLabel(project)} />
                <InspectorRow label="Runtime" value={resolveBannerRuntime(project)} />
                <InspectorRow label="Status" value={resolveStatusLabel(resolveStatusKey(project))} />
                <InspectorRow label="Owner" value={project.ownerName ?? project.ownerUserId} />
                <InspectorRow label="Updated" value={formatRelativeTime(project.updatedAt)} />
              </div>
            ) : null}

            {tab === 'export' ? (
              <div className="client-workspace-inspector__stack">
                <div className="client-workspace-inspector__export-card">
                  <strong>Package readiness</strong>
                  <span>{resolveWeightEstimate(project)} estimated bundle weight</span>
                </div>
                <div className="client-workspace-inspector__export-card">
                  <strong>Delivery format</strong>
                  <span>{resolveBannerFormatLabel(project)}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="compact-action client-workspace-inspector__open-button"
                  iconBefore={<StudioIcon icon={StudioIcons.externalLink} size={14} />}
                  onClick={() => onOpenProject(project.id)}
                >
                  Open in Studio
                </Button>
              </div>
            ) : null}

            {tab === 'history' ? (
              <div className="client-workspace-inspector__history">
                {historyItems.map((item) => (
                  <div key={item.id} className="client-workspace-inspector__history-item">
                    <span>{item.label}</span>
                    <strong>{item.detail}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="client-workspace-inspector__empty">
            <StudioIcon icon={StudioIcons.layoutGrid} size={32} />
            <h3>Workspace overview</h3>
            <p>Select a banner to inspect props, export surface, and recent activity. Until then, the workspace stays anchored to the active client.</p>
            <div className="client-workspace-inspector__history">
              {overviewItems.map((item) => (
                <div key={item.id} className="client-workspace-inspector__history-item">
                  <span>{item.label}</span>
                  <strong>{item.detail}</strong>
                </div>
              ))}
            </div>
            {palette.length > 0 ? (
              <div className="client-workspace-inspector__palette" aria-hidden="true">
                {palette.map((color) => (
                  <svg key={color} viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                    <circle cx="10" cy="10" r="8" fill={color} />
                  </svg>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
