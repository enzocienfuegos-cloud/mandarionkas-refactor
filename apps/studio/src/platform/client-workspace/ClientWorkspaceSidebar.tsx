import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import type { QuickFilterId } from './production-helpers';

type ClientWorkspaceSidebarProps = {
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
};

export function ClientWorkspaceSidebar({
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
}: ClientWorkspaceSidebarProps): JSX.Element {
  return (
    <aside className="client-workspace-production__sidebar panel">
      <div className="client-workspace-sidebar__brand">
        <img src="/assets/mandarion-logo-white.svg" alt="MandaRion" className="client-workspace-sidebar__logo" />
        <p>Este workspace opera campañas, formatos y estados del cliente activo. Los clientes y sus brand kits viven en el hub.</p>
      </div>

      <section className="client-workspace-sidebar__section">
        <div className="workspace-hub-kicker">Campañas</div>
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
              placeholder="Nombre de la carpeta"
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
              <Button variant="ghost" size="sm" className="compact-action" onClick={() => { onSetCreatingFolder(false); onSetFolderDraftName(''); }}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" className="compact-action" onClick={onCreateFolder}>
                Guardar
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
            Nueva carpeta
          </Button>
        )}
      </section>

      <section className="client-workspace-sidebar__section">
        <div className="workspace-hub-kicker">Filtros rápidos</div>
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
    </aside>
  );
}
