import { Button } from '../../shared/ui/Button';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { QuickFilterId } from './production-helpers';

type WorkspaceToolbarProps = {
  search: string;
  onSearchChange(value: string): void;
  quickFilter: QuickFilterId;
  onQuickFilterChange(value: QuickFilterId): void;
  quickFilterOptions: Array<{ id: QuickFilterId; label: string; count: number }>;
  sortMode: 'recent' | 'name';
  onSortModeChange(value: 'recent' | 'name'): void;
  viewMode: 'card' | 'list';
  onViewModeChange(value: 'card' | 'list'): void;
  onCreateFolder(): void;
  onCreateBanner(): void;
  canCreateProjects: boolean;
};

export function ClientWorkspaceToolbar({
  search,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  quickFilterOptions,
  sortMode,
  onSortModeChange,
  viewMode,
  onViewModeChange,
  onCreateFolder,
  onCreateBanner,
  canCreateProjects,
}: WorkspaceToolbarProps): JSX.Element {
  return (
    <>
      <section className="client-workspace-main__toolbar panel">
        <label className="client-workspace-search">
          <StudioIcon icon={StudioIcons.scanSearch} size={16} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter in the workspace..."
            aria-label="Filter in the workspace"
          />
        </label>
        <label className="client-workspace-toolbar-select">
          <span>Format</span>
          <select
            value={resolveFilterFormatOption(quickFilter)}
            onChange={(event) => onQuickFilterChange(resolveQuickFilterSelection(event.target.value))}
            aria-label="Filter banners by format"
          >
            <option value="all">All formats</option>
            <option value="html5">HTML5</option>
            <option value="mraid">MRAID</option>
            <option value="vast">VAST</option>
            <option value="static">Static</option>
            <option value="playable">Playable</option>
          </select>
        </label>
        <label className="client-workspace-toolbar-select">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as 'recent' | 'name')} aria-label="Sort banners">
            <option value="recent">Recently updated</option>
            <option value="name">A to Z</option>
          </select>
        </label>
        <SegmentedControl
          options={[
            { id: 'card', label: 'Cards' },
            { id: 'list', label: 'Rows' },
          ]}
          value={viewMode}
          onChange={onViewModeChange}
          ariaLabel="Banner view mode"
        />
        <Button variant="ghost" size="sm" className="compact-action" iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />} onClick={onCreateFolder}>
          New folder
        </Button>
        <Button variant="primary" size="sm" className="compact-action" iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />} onClick={onCreateBanner} disabled={!canCreateProjects}>
          New banner
        </Button>
      </section>

      <div className="client-workspace-main__subfilters">
        {quickFilterOptions.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`filter-pill ${quickFilter === filter.id ? 'is-active' : ''}`.trim()}
            onClick={() => onQuickFilterChange(filter.id)}
          >
            {filter.label}
            <span>{filter.count}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function resolveFilterFormatOption(filter: QuickFilterId): string {
  switch (filter) {
    case 'html5':
    case 'mraid':
    case 'vast':
    case 'static':
    case 'playable':
      return filter;
    default:
      return 'all';
  }
}

function resolveQuickFilterSelection(value: string): QuickFilterId {
  switch (value) {
    case 'html5':
    case 'mraid':
    case 'vast':
    case 'static':
    case 'playable':
      return value;
    default:
      return 'all';
  }
}
