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
  onSetActiveFolderId(folderId: string): void;
  onSetQuickFilter(filterId: QuickFilterId): void;
  onSetCreatingFolder(value: boolean): void;
  onSetFolderDraftName(value: string): void;
  onCreateFolder(): void;
  onOpenBrandKit(): void;
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
  onSetActiveFolderId,
  onSetQuickFilter,
  onSetCreatingFolder,
  onSetFolderDraftName,
  onCreateFolder,
  onOpenBrandKit,
}: ClientWorkspaceSidebarProps): JSX.Element {
  const primaryBrand = activeClient?.brands?.[0];
  const palette = resolveBrandPalette(activeClient);
  const fontFamily = resolveBrandFont(primaryBrand);

  return (
    <aside className="client-workspace-production__sidebar panel">
      <section className="client-workspace-sidebar__section">
        <div className="client-workspace-sidebar__section-header">
          <div className="workspace-hub-kicker">Campaign folders</div>
          <span className="pill">{Math.max(folderOptions.length - 2, 0)}</span>
        </div>
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
      </section>

      <section className="client-workspace-sidebar__section">
        <div className="workspace-hub-kicker">Quick filters</div>
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
      </section>

      <section className="client-workspace-sidebar__section">
        <div className="client-workspace-sidebar__section-header">
          <div className="workspace-hub-kicker">Brand Kit</div>
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
            <div className="client-workspace-sidebar__font-preview">{fontFamily ? 'Aa' : 'Aa'}</div>
          </button>
        </div>
      </section>
    </aside>
  );
}
