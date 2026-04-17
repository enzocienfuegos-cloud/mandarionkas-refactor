import { useMemo, useState } from 'react';
import { getCanvasPresetById } from '../types/canvas-presets';
import { BuildTimePanel } from './workspace-hub/BuildTimePanel';
import { ProjectsTable } from './workspace-hub/ProjectsTable';
import { QuickActions } from './workspace-hub/QuickActions';
import { RecentExports } from './workspace-hub/RecentExports';
import { SummaryCard } from './workspace-hub/SummaryCard';
import { ActivityIcon, ExportIcon, FolderIcon, HomeIcon, MediaIcon, ReportIcon, SettingsIcon, ShieldIcon, TemplateIcon, UsersIcon } from './workspace-hub/icons';
import type { BuildTimeSnapshot, DisplayMode, RecentExportItem, SummaryCardData, WorkspaceFilters, WorkspaceProjectColumn, WorkspaceProjectFormat, WorkspaceProjectRow, WorkspaceProjectStatus } from './workspace-hub/types';
import { WorkspaceHeader } from './workspace-hub/WorkspaceHeader';
import { useWorkspaceHubController } from './workspace-hub/use-workspace-hub-controller';

type WorkspaceHubProps = {
  onEnterEditor(): void;
};

const sidebarSections = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', icon: HomeIcon, active: true },
      { label: 'Projects', icon: FolderIcon },
      { label: 'Folders', icon: FolderIcon },
      { label: 'Templates', icon: TemplateIcon },
      { label: 'Media Library', icon: MediaIcon },
      { label: 'Exports', icon: ExportIcon },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Clients', icon: UsersIcon },
      { label: 'Users', icon: UsersIcon },
      { label: 'Roles & Permissions', icon: ShieldIcon },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', icon: ReportIcon },
      { label: 'Activity Log', icon: ActivityIcon },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Workspace Settings', icon: SettingsIcon },
      { label: 'Preferences', icon: SettingsIcon },
    ],
  },
] as const;

const columnOptions: Array<{ id: WorkspaceProjectColumn; label: string }> = [
  { id: 'project', label: 'Project' },
  { id: 'format', label: 'Format' },
  { id: 'size', label: 'Size' },
  { id: 'status', label: 'Status' },
  { id: 'lastUpdated', label: 'Last updated' },
  { id: 'owner', label: 'Owner' },
  { id: 'progress', label: 'Progress' },
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due date' },
  { id: 'channel', label: 'Channel' },
  { id: 'version', label: 'Version' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'folder', label: 'Folder' },
  { id: 'tags', label: 'Tags' },
] as const;

const defaultVisibleColumns: WorkspaceProjectColumn[] = [
  'project',
  'format',
  'size',
  'status',
  'lastUpdated',
  'owner',
  'progress',
];

const defaultFilters: WorkspaceFilters = {
  format: 'all',
  folder: 'all',
  status: 'all',
  owner: 'all',
  lastUpdated: 'all',
  size: 'all',
};

const buildTimeSnapshot: BuildTimeSnapshot = {
  averageDays: '1.1 days',
  deltaLabel: '18% faster vs last week',
  slowProjects: 2,
  byFormat: [
    { format: 'Rich Media', days: '1.2 days', progress: 78, tone: 'pink' },
    { format: 'HTML5', days: '0.8 days', progress: 52, tone: 'blue' },
    { format: 'Takeover', days: '1.6 days', progress: 92, tone: 'violet' },
  ],
};

function formatUpdatedTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function inferFormat(label?: string, name?: string): WorkspaceProjectFormat {
  const haystack = `${label ?? ''} ${name ?? ''}`.toLowerCase();
  if (haystack.includes('takeover') || haystack.includes('1920x1080')) return 'Takeover';
  if (haystack.includes('300x250') || haystack.includes('1200x628') || haystack.includes('html5')) return 'HTML5';
  return 'Rich Media';
}

function inferStatus(progress: number): WorkspaceProjectStatus {
  if (progress >= 90) return 'Review';
  if (progress <= 25) return 'Draft';
  return 'In progress';
}

function initials(name?: string): string {
  const value = name?.trim() || 'Studio User';
  return value.split(/\s+/).map((token) => token.charAt(0)).join('').slice(0, 2).toUpperCase();
}

function toneFromIndex(index: number): WorkspaceProjectRow['thumbnailTone'] {
  const tones: WorkspaceProjectRow['thumbnailTone'][] = ['pink', 'violet', 'blue', 'amber', 'green'];
  return tones[index % tones.length];
}

function progressFromIndex(index: number): number {
  const values = [75, 100, 40, 20, 100];
  return values[index % values.length];
}

function priorityFromProgress(progress: number): WorkspaceProjectRow['priority'] {
  if (progress >= 80) return 'Low';
  if (progress >= 40) return 'Medium';
  return 'High';
}

function channelFromFormat(format: WorkspaceProjectFormat): string {
  if (format === 'Takeover') return 'Homepage';
  if (format === 'HTML5') return 'Display';
  return 'Rich Media';
}

function dueDateFromIndex(index: number): string {
  const dates = ['May 3', 'May 7', 'May 10', 'May 12', 'May 15'];
  return dates[index % dates.length];
}

function tagsFromFormat(format: WorkspaceProjectFormat): string[] {
  if (format === 'Takeover') return ['Launch', 'Homepage'];
  if (format === 'HTML5') return ['Display', 'Prospecting'];
  return ['Social', 'Interactive'];
}

function toWorkspaceRow(project: ReturnType<typeof useWorkspaceHubController>['filteredProjects'][number], index: number): WorkspaceProjectRow {
  const preset = getCanvasPresetById(project.canvasPresetId);
  const size = preset ? `${preset.width}x${preset.height}` : 'Custom';
  const format = inferFormat(preset?.label, project.name);
  const progress = progressFromIndex(index);
  return {
    id: project.id,
    name: project.name,
    folder: project.campaignName || 'Workspace',
    format,
    size,
    status: inferStatus(progress),
    lastUpdated: formatUpdatedTime(project.updatedAt),
    updatedAt: project.updatedAt,
    owner: project.ownerName || project.ownerUserId,
    ownerInitials: initials(project.ownerName || project.ownerUserId),
    progress,
    priority: priorityFromProgress(progress),
    dueDate: dueDateFromIndex(index),
    channel: channelFromFormat(format),
    version: `v${Math.max(1, index + 2)}`,
    campaign: project.campaignName || 'Always on',
    tags: tagsFromFormat(format),
    thumbnailTone: toneFromIndex(index),
    archivedAt: project.archivedAt,
  };
}

function matchesLastUpdated(updatedAt: string, filter: WorkspaceFilters['lastUpdated']): boolean {
  if (filter === 'all') return true;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (filter === '24h') return hours <= 24;
  if (filter === '7d') return hours <= 24 * 7;
  if (filter === '30d') return hours <= 24 * 30;
  return true;
}

function createRecentExports(projects: WorkspaceProjectRow[]): RecentExportItem[] {
  const fallback = ['Promo Junio', 'Brand Awareness', 'Homepage Takeover'];
  const source = projects.length ? projects.slice(0, 3).map((project) => project.name) : fallback;
  return source.map((name, index) => ({
    id: `${name}-${index}`,
    projectName: name,
    exportType: 'HTML5 Zip',
    timeAgo: ['2h ago', '3h ago', '1d ago'][index] ?? '2d ago',
    tone: toneFromIndex(index),
    ok: true,
  }));
}

export function WorkspaceHub({ onEnterEditor }: WorkspaceHubProps): JSX.Element {
  const controller = useWorkspaceHubController();
  const { workspace, projectSession, activeClient, clients, search, setSearch, filteredProjects } = controller;

  const [visibleColumns, setVisibleColumns] = useState<WorkspaceProjectColumn[]>(defaultVisibleColumns);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('list');
  const [filters, setFilters] = useState<WorkspaceFilters>(defaultFilters);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo(() => filteredProjects.map(toWorkspaceRow), [filteredProjects]);

  const visibleProjects = useMemo(() => rows.filter((project) => {
    if (filters.format !== 'all' && project.format !== filters.format) return false;
    if (filters.folder !== 'all' && project.folder !== filters.folder) return false;
    if (filters.status !== 'all' && project.status !== filters.status) return false;
    if (filters.owner !== 'all' && project.owner !== filters.owner) return false;
    if (filters.size !== 'all' && project.size !== filters.size) return false;
    if (!matchesLastUpdated(project.updatedAt, filters.lastUpdated)) return false;
    return true;
  }), [filters, rows]);

  const summaryCards = useMemo<SummaryCardData[]>(() => {
    const activeProjects = rows.filter((project) => !project.archivedAt).length;
    const updatedProjects = rows.filter((project) => matchesLastUpdated(project.updatedAt, '7d')).length;
    const exportsThisWeek = createRecentExports(rows).length;
    return [
      { id: 'active', label: 'Active projects', value: String(activeProjects), helper: 'In progress across this workspace', tone: 'pink' },
      { id: 'updated', label: 'Projects updated', value: String(updatedProjects), helper: 'Updated in the last 7 days', tone: 'violet' },
      { id: 'exports', label: 'Exports this week', value: String(exportsThisWeek), helper: 'HTML5 packages generated', tone: 'green' },
      { id: 'clients', label: 'Clients', value: String(clients.length), helper: 'Visible in your current session', tone: 'amber' },
    ];
  }, [clients.length, rows]);

  const recentExports = useMemo(() => createRecentExports(rows), [rows]);
  const ownerOptions = useMemo(() => Array.from(new Set(rows.map((project) => project.owner))), [rows]);
  const folderOptions = useMemo(() => Array.from(new Set(rows.map((project) => project.folder))), [rows]);
  const sizeOptions = useMemo(() => Array.from(new Set(rows.map((project) => project.size))), [rows]);

  async function handleOpen(projectId: string): Promise<void> {
    await controller.openProject(projectId);
    onEnterEditor();
  }

  function handleCreate(): void {
    controller.createProjectDraft();
    onEnterEditor();
  }

  async function handleDuplicatePreferred(): Promise<void> {
    const target = visibleProjects[0];
    if (!target) return;
    await controller.duplicateProjectCard(target.id);
  }

  async function handleUploadAssets(): Promise<void> {
    const target = visibleProjects[0];
    if (target) {
      await handleOpen(target.id);
      return;
    }
    handleCreate();
  }

  async function handleArchive(projectId: string): Promise<void> {
    await controller.archiveProjectCard(projectId);
  }

  function toggleColumn(column: WorkspaceProjectColumn): void {
    setVisibleColumns((current) => {
      if (column === 'project') return current;
      return current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column];
    });
  }

  return (
    <div className="workspace-admin-shell">
      <aside className="workspace-admin-sidebar">
        <div className="workspace-admin-brand">
          <div className="workspace-admin-brand-mark">S</div>
          <div>
            <strong>SMX Studio</strong>
            <span>Workspace control center</span>
          </div>
        </div>
        <nav className="workspace-admin-nav">
          {sidebarSections.map((section) => (
            <div key={section.label} className="workspace-admin-nav-section">
              <div className="workspace-admin-nav-label">{section.label}</div>
              <div className="workspace-admin-nav-list">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className={`workspace-admin-nav-item ${item.active ? 'is-active' : ''}`}>
                      <Icon className="workspace-admin-inline-icon" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="workspace-admin-sidebar-footer">
          <div className="workspace-admin-sidebar-client-mark">{(activeClient?.name ?? 'WS').slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{activeClient?.name ?? 'Workspace'}</strong>
            <span>{activeClient?.memberUserIds.length ?? 0} members</span>
          </div>
        </div>
      </aside>

      <main className="workspace-admin-main">
        <div className="workspace-admin-scroll">
          <WorkspaceHeader
            activeWorkspaceId={workspace.activeClientId}
            currentWorkspaceName={activeClient?.name ?? 'Current workspace'}
            currentUserEmail={workspace.currentUser?.email ?? 'user@smxstudio.io'}
            currentUserName={workspace.currentUser?.name ?? 'Admin User'}
            notificationCount={2}
            search={search}
            workspaces={clients.map((client) => ({ id: client.id, name: client.name }))}
            onWorkspaceChange={(workspaceId) => void workspace.handleActiveClientChange(workspaceId)}
            onSearchChange={(value) => setSearch(value)}
            onCreateProject={handleCreate}
          />

          <section className="workspace-admin-summary-grid">
            {summaryCards.map((card) => <SummaryCard key={card.id} card={card} />)}
          </section>

          <div className="workspace-admin-content-grid">
            <ProjectsTable
              projects={visibleProjects}
              visibleColumns={visibleColumns}
              displayMode={displayMode}
              filters={filters}
              ownerOptions={ownerOptions}
              folderOptions={folderOptions}
              sizeOptions={sizeOptions}
              columnsOpen={columnsOpen}
              filtersOpen={filtersOpen}
              columnOptions={columnOptions}
              onToggleColumns={() => {
                setColumnsOpen((current) => !current);
                setFiltersOpen(false);
              }}
              onToggleFilters={() => {
                setFiltersOpen((current) => !current);
                setColumnsOpen(false);
              }}
              onToggleColumn={toggleColumn}
              onDisplayModeChange={setDisplayMode}
              onFilterChange={setFilters}
              onOpenProject={(projectId) => void handleOpen(projectId)}
              onDuplicateProject={(projectId) => void controller.duplicateProjectCard(projectId)}
              onArchiveProject={(projectId) => void handleArchive(projectId)}
              onCreateProject={handleCreate}
              onUploadAssets={() => void handleUploadAssets()}
            />

            <aside className="workspace-admin-right-rail">
              <QuickActions
                canCreate={workspace.canCreateProjects}
                canDuplicate={visibleProjects.length > 0}
                canUpload={true}
                onCreate={handleCreate}
                onDuplicate={() => void handleDuplicatePreferred()}
                onUpload={() => void handleUploadAssets()}
              />
              <RecentExports items={recentExports} />
              <BuildTimePanel snapshot={buildTimeSnapshot} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
