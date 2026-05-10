import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { formatRelativeTime, type WorkspaceProjectItem } from './WorkspaceProjectViews';
import {
  formatCanvas,
  resolveBannerFormatLabel,
  resolveBannerRuntime,
  resolveStatusKey,
  resolveStatusLabel,
  resolveThumbVariant,
  resolveWeightEstimate,
  type BannerStatusKey,
  type CampaignGroup,
} from './production-helpers';

type CampaignGroupsProps = {
  campaignGroups: CampaignGroup[];
  viewMode: 'card' | 'list';
  expandedGroupIds: string[];
  selectedSet: Set<string>;
  inspectedProjectId?: string;
  visibleProjectsCount: number;
  allVisibleSelected: boolean;
  onToggleVisibleSelection(): void;
  onToggleGroup(groupId: string): void;
  onToggleGroupSelection(group: CampaignGroup): void;
  onToggleProjectSelection(projectId: string): void;
  onInspectProject(projectId: string): void;
  onOpenProject(projectId: string): void;
};

function ProductionStatusPill({ status }: { status: BannerStatusKey }): JSX.Element {
  return (
    <span className={`client-workspace-inline-status client-workspace-inline-status--${status}`.trim()}>
      {resolveStatusLabel(status)}
    </span>
  );
}

function BannerListRow({
  project,
  selected,
  inspected,
  onInspectProject,
  onToggleProjectSelection,
  onOpenProject,
}: {
  project: WorkspaceProjectItem;
  selected: boolean;
  inspected: boolean;
  onInspectProject(projectId: string): void;
  onToggleProjectSelection(projectId: string): void;
  onOpenProject(projectId: string): void;
}): JSX.Element {
  const status = resolveStatusKey(project);
  return (
    <div className={`client-workspace-banner-list__row ${selected ? 'is-selected' : ''} ${inspected ? 'is-inspected' : ''}`.trim()}>
      <label className="client-workspace-banner-list__name">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleProjectSelection(project.id)}
        />
        <button type="button" onClick={() => onInspectProject(project.id)}>
          <strong>{project.name}</strong>
          <small>{project.brandName ?? 'No brand'} · {project.ownerName ?? project.ownerUserId}</small>
        </button>
      </label>
      <span>{formatCanvas(project)}</span>
      <span>{resolveBannerFormatLabel(project)}</span>
      <span>{resolveBannerRuntime(project)}</span>
      <ProductionStatusPill status={status} />
      <span>{resolveWeightEstimate(project)}</span>
      <div className="client-workspace-banner-list__actions">
        <span>{formatRelativeTime(project.updatedAt)}</span>
        <Button variant="ghost" size="sm" className="compact-action" onClick={() => onOpenProject(project.id)}>
          Open
        </Button>
      </div>
    </div>
  );
}

function BannerCard({
  project,
  groupName,
  selected,
  inspected,
  onInspectProject,
  onToggleProjectSelection,
  onOpenProject,
}: {
  project: WorkspaceProjectItem;
  groupName: string;
  selected: boolean;
  inspected: boolean;
  onInspectProject(projectId: string): void;
  onToggleProjectSelection(projectId: string): void;
  onOpenProject(projectId: string): void;
}): JSX.Element {
  const status = resolveStatusKey(project);
  return (
    <article className={`client-workspace-banner-card ${selected ? 'is-selected' : ''} ${inspected ? 'is-inspected' : ''}`.trim()}>
      <div className={`client-workspace-banner-card__preview client-workspace-banner-card__preview--${resolveThumbVariant(project)}`.trim()}>
        <label className="client-workspace-banner-card__check">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleProjectSelection(project.id)}
          />
          <span>Select</span>
        </label>
        <button type="button" className="client-workspace-banner-card__surface" onClick={() => onInspectProject(project.id)}>
          <div className="client-workspace-banner-card__frame">
            <span>{formatCanvas(project)}</span>
            <small>{resolveBannerFormatLabel(project)}</small>
          </div>
        </button>
      </div>
      <div className="client-workspace-banner-card__body">
        <div className="client-workspace-banner-card__title">
          <div>
            <h4>{project.name}</h4>
            <p>{project.brandName ?? 'No brand'} · {project.campaignName ?? groupName}</p>
          </div>
          <ProductionStatusPill status={status} />
        </div>
        <div className="client-workspace-banner-card__meta">
          <div>
            <span>Size</span>
            <strong>{formatCanvas(project)}</strong>
          </div>
          <div>
            <span>Format</span>
            <strong>{resolveBannerFormatLabel(project)}</strong>
          </div>
          <div>
            <span>Runtime</span>
            <strong>{resolveBannerRuntime(project)}</strong>
          </div>
          <div>
            <span>Weight</span>
            <strong>{resolveWeightEstimate(project)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{resolveStatusLabel(status)}</strong>
          </div>
          <div>
            <span>Updated</span>
            <strong>{formatRelativeTime(project.updatedAt)}</strong>
          </div>
        </div>
        <div className="client-workspace-banner-card__footer">
          <span className="pill">{project.ownerName ?? project.ownerUserId}</span>
          <Button variant="ghost" size="sm" className="compact-action" onClick={() => onOpenProject(project.id)}>
            Open
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ClientWorkspaceCampaignGroups({
  campaignGroups,
  viewMode,
  expandedGroupIds,
  selectedSet,
  inspectedProjectId,
  visibleProjectsCount,
  allVisibleSelected,
  onToggleVisibleSelection,
  onToggleGroup,
  onToggleGroupSelection,
  onToggleProjectSelection,
  onInspectProject,
  onOpenProject,
}: CampaignGroupsProps): JSX.Element {
  return (
    <section className="client-workspace-rows panel">
      <div className="client-workspace-rows__header">
        <div>
          <div className="workspace-hub-kicker">Production queue</div>
          <h3>{visibleProjectsCount} banners in the active workspace.</h3>
        </div>
        <Button variant="ghost" size="sm" className="compact-action" onClick={onToggleVisibleSelection}>
          {allVisibleSelected ? 'Clear visible' : 'Select visible'}
        </Button>
      </div>

      {campaignGroups.length > 0 ? (
        <div className="client-workspace-campaign-groups">
          {campaignGroups.map((group) => {
            const groupIds = group.projects.map((project) => project.id);
            const groupSelected = groupIds.every((projectId) => selectedSet.has(projectId));
            const expanded = expandedGroupIds.includes(group.id);
            return (
              <section key={group.id} className="client-workspace-campaign">
                <div className="client-workspace-campaign__row">
                  <div className="client-workspace-campaign__row-main">
                    <input
                      type="checkbox"
                      checked={groupSelected}
                      aria-label={`Select ${group.name}`}
                      onChange={() => onToggleGroupSelection(group)}
                    />
                    <button type="button" className="client-workspace-campaign__toggle" onClick={() => onToggleGroup(group.id)}>
                      <StudioIcon icon={expanded ? StudioIcons.chevronDown : StudioIcons.chevronRight} size={16} />
                      <span>{group.name}</span>
                    </button>
                  </div>
                  <div className="client-workspace-campaign__row-meta">
                    <span>{group.clientName}</span>
                    <span>{group.projects.length} banners</span>
                    <span>Updated {formatRelativeTime(group.updatedAt)}</span>
                    <ProductionStatusPill status={group.status} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="compact-action"
                      onClick={() => {
                        if (group.projects[0]) onOpenProject(group.projects[0].id);
                      }}
                      disabled={!group.projects[0]}
                    >
                      Open
                    </Button>
                  </div>
                </div>

                {expanded ? (
                  viewMode === 'list' ? (
                    <div className="client-workspace-banner-list">
                      <div className="client-workspace-banner-list__head">
                        <span>Name</span>
                        <span>Size</span>
                        <span>Format</span>
                        <span>Runtime</span>
                        <span>Status</span>
                        <span>Weight</span>
                        <span>Updated</span>
                      </div>
                      {group.projects.map((project) => (
                        <BannerListRow
                          key={project.id}
                          project={project}
                          selected={selectedSet.has(project.id)}
                          inspected={project.id === inspectedProjectId}
                          onInspectProject={onInspectProject}
                          onToggleProjectSelection={onToggleProjectSelection}
                          onOpenProject={onOpenProject}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="client-workspace-banner-grid">
                      {group.projects.map((project) => (
                        <BannerCard
                          key={project.id}
                          project={project}
                          groupName={group.name}
                          selected={selectedSet.has(project.id)}
                          inspected={project.id === inspectedProjectId}
                          onInspectProject={onInspectProject}
                          onToggleProjectSelection={onToggleProjectSelection}
                          onOpenProject={onOpenProject}
                        />
                      ))}
                    </div>
                  )
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="client-workspace-empty-state">
          <h3>No banners match this workspace filter.</h3>
          <p>Try another campaign, quick filter, or search to bring work back into the production queue.</p>
        </div>
      )}
    </section>
  );
}
