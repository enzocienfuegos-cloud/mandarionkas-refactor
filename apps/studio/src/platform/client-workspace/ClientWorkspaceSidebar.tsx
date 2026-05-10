import { useState } from 'react';
import type { BrandKit, ClientWorkspace } from '../types';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { QuickFilterId } from './production-helpers';

type ClientWorkspaceSidebarProps = {
  activeClient?: ClientWorkspace;
  canManageBrandkits: boolean;
  activeFolderId: string;
  folderOptions: Array<{ id: string; name: string; count: number }>;
  quickFilter: QuickFilterId;
  quickFilterOptions: Array<{ id: QuickFilterId; label: string; count: number }>;
  creatingFolder: boolean;
  folderDraftName: string;
  collapsed: boolean;
  onSetActiveFolderId(folderId: string): void;
  onSetQuickFilter(filterId: QuickFilterId): void;
  onSetCreatingFolder(value: boolean): void;
  onSetFolderDraftName(value: string): void;
  onCreateFolder(): void;
  onOpenBrandKit(): void;
  onToggleCollapsed(): void;
};

function resolveBrandPalette(activeClient?: ClientWorkspace): string[] {
  const primaryBrand = activeClient?.brands?.[0];
  return Array.from(
    new Set(
      [
        activeClient?.brandColor,
        primaryBrand?.primaryColor,
        primaryBrand?.secondaryColor,
        primaryBrand?.accentColor,
      ].filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 4);
}

function resolveBrandFont(primaryBrand?: BrandKit): string | null {
  const fontFamily = primaryBrand?.fontFamily?.trim();
  return fontFamily ? fontFamily : null;
}

export function ClientWorkspaceSidebar({
  activeClient,
  canManageBrandkits,
  activeFolderId,
  folderOptions,
  quickFilter,
  quickFilterOptions,
  creatingFolder,
  folderDraftName,
  collapsed,
  onSetActiveFolderId,
  onSetQuickFilter,
  onSetCreatingFolder,
  onSetFolderDraftName,
  onCreateFolder,
  onOpenBrandKit,
  onToggleCollapsed,
}: ClientWorkspaceSidebarProps): JSX.Element {
  const primaryBrand = activeClient?.brands?.[0];
  const palette = resolveBrandPalette(activeClient);
  const fontFamily = resolveBrandFont(primaryBrand);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [brandKitOpen, setBrandKitOpen] = useState(true);

  if (collapsed) {
    return (
      <aside className="client-workspace-production__sidebar client-workspace-production__sidebar--collapsed panel">
        <div className="client-workspace-sidebar__collapsed-actions">
          <button
            type="button"
            className="client-workspace-sidebar__collapse-toggle"
            aria-label="Expand workspace sidebar"
            onClick={onToggleCollapsed}
          >
            <StudioIcon icon={StudioIcons.panelLeftOpen} size={16} />
          </button>
          <button
            type="button"
            className="client-workspace-sidebar__collapsed-button"
            aria-label="Open folders"
            onClick={onToggleCollapsed}
          >
            <StudioIcon icon={StudioIcons.folder} size={16} />
          </button>
          <button
            type="button"
            className="client-workspace-sidebar__collapsed-button"
            aria-label="Open filters"
            onClick={onToggleCollapsed}
          >
            <StudioIcon icon={StudioIcons.tag} size={16} />
          </button>
          <button
            type="button"
            className="client-workspace-sidebar__collapsed-button"
            aria-label="Open brand kit"
            onClick={onOpenBrandKit}
          >
            <StudioIcon icon={StudioIcons.palette} size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="client-workspace-production__sidebar panel">
      <div className="client-workspace-sidebar__rail-header">
        <span className="ws-sidebar-kicker">Workspace</span>
        <button
          type="button"
          className="client-workspace-sidebar__collapse-toggle"
          aria-label="Collapse workspace sidebar"
          onClick={onToggleCollapsed}
        >
          <StudioIcon icon={StudioIcons.panelLeftOpen} size={16} />
        </button>
      </div>

      <section className="client-workspace-sidebar__section">
        <button type="button" className="client-workspace-sidebar__section-toggle" onClick={() => setFoldersOpen((current) => !current)}>
          <div>
            <span className="ws-sidebar-kicker">Folders</span>
            <div className="workspace-hub-kicker">Campaign folders</div>
          </div>
          <span className="client-workspace-sidebar__section-toggle-meta">
            <span className="pill">{Math.max(folderOptions.length - 2, 0)}</span>
            <StudioIcon icon={foldersOpen ? StudioIcons.chevronDown : StudioIcons.chevronRight} size={16} />
          </span>
        </button>
        {foldersOpen ? (
          <>
            <div className="client-workspace-sidebar__list">
              {folderOptions.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`client-workspace-sidebar__link ${activeFolderId === folder.id ? 'is-active' : ''}`.trim()}
                  onClick={() => onSetActiveFolderId(folder.id)}
                >
                  <span className="client-workspace-sidebar__link-copy">
                    <StudioIcon icon={StudioIcons.folder} size={14} />
                    {folder.name}
                  </span>
                  <strong>{folder.count}</strong>
                </button>
              ))}
            </div>
            {creatingFolder ? (
              <div className="client-workspace-sidebar__folder-draft">
                <input
                  autoFocus
                  value={folderDraftName}
                  placeholder="Folder name"
                  onChange={(event) => onSetFolderDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onCreateFolder();
                    if (event.key === 'Escape') {
                      onSetCreatingFolder(false);
                      onSetFolderDraftName('');
                    }
                  }}
                />
                <div className="client-workspace-sidebar__folder-draft-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="compact-action"
                    onClick={() => {
                      onSetCreatingFolder(false);
                      onSetFolderDraftName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" className="compact-action" onClick={onCreateFolder}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="compact-action client-workspace-sidebar__folder-create"
                iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />}
                onClick={() => onSetCreatingFolder(true)}
              >
                New folder
              </Button>
            )}
          </>
        ) : null}
      </section>

      <section className="client-workspace-sidebar__section">
        <button type="button" className="client-workspace-sidebar__section-toggle" onClick={() => setFiltersOpen((current) => !current)}>
          <div>
            <span className="ws-sidebar-kicker">Filters</span>
            <div className="workspace-hub-kicker">Quick filters</div>
          </div>
          <StudioIcon icon={filtersOpen ? StudioIcons.chevronDown : StudioIcons.chevronRight} size={16} />
        </button>
        {filtersOpen ? (
          <div className="client-workspace-sidebar__filters">
            {quickFilterOptions.slice(1).map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`client-workspace-sidebar__filter ${quickFilter === filter.id ? 'is-active' : ''}`.trim()}
                onClick={() => onSetQuickFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <strong>{filter.count}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="client-workspace-sidebar__section">
        <div className="client-workspace-sidebar__section-header client-workspace-sidebar__section-header--split">
          <button type="button" className="client-workspace-sidebar__section-toggle client-workspace-sidebar__section-toggle--compact" onClick={() => setBrandKitOpen((current) => !current)}>
            <div className="workspace-hub-kicker">Brand Kit</div>
            <StudioIcon icon={brandKitOpen ? StudioIcons.chevronDown : StudioIcons.chevronRight} size={16} />
          </button>
          {canManageBrandkits ? (
            <Button
              variant="ghost"
              size="sm"
              className="compact-action"
              iconBefore={<StudioIcon icon={StudioIcons.palette} size={14} />}
              onClick={onOpenBrandKit}
            >
              Open
            </Button>
          ) : null}
        </div>
        {brandKitOpen ? (
          <div className="client-workspace-sidebar__brand-grid">
            <button
              type="button"
              className="client-workspace-sidebar__brand-card client-workspace-sidebar__brand-card--interactive"
              onClick={onOpenBrandKit}
              disabled={!canManageBrandkits}
            >
              <strong>Colors</strong>
              <small>{primaryBrand?.name ?? activeClient?.name ?? 'Active client'}</small>
              <div className="client-workspace-sidebar__swatches" aria-hidden="true">
                {palette.length > 0 ? (
                  palette.map((color) => (
                    <svg key={color} viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                      <circle cx="10" cy="10" r="8" fill={color} />
                    </svg>
                  ))
                ) : (
                  <span className="client-workspace-sidebar__swatch-placeholder">No palette</span>
                )}
              </div>
            </button>

            <button
              type="button"
              className="client-workspace-sidebar__brand-card client-workspace-sidebar__brand-card--interactive"
              onClick={onOpenBrandKit}
              disabled={!canManageBrandkits}
            >
              <strong>Typography</strong>
              <small>{fontFamily ?? 'Not defined yet'}</small>
              <div className="client-workspace-sidebar__font-preview">Aa</div>
            </button>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
