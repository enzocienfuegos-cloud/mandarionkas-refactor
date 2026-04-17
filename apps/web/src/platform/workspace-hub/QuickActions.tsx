import type { JSX } from 'react';
import { ArrowRightIcon, DuplicateIcon, FolderIcon, PlusIcon, UploadIcon } from './icons';

type QuickActionsProps = {
  canCreate: boolean;
  canDuplicate: boolean;
  canUpload: boolean;
  onCreate(): void;
  onDuplicate(): void;
  onUpload(): void;
};

const actions = [
  { id: 'create', label: 'New project', detail: 'Start from scratch', icon: PlusIcon },
  { id: 'duplicate', label: 'Duplicate project', detail: 'Copy and keep editing', icon: DuplicateIcon },
  { id: 'upload', label: 'Upload assets', detail: 'Open the editor media library', icon: UploadIcon },
  { id: 'folder', label: 'New folder', detail: 'Organize your projects', icon: FolderIcon },
] as const;

export function QuickActions({ canCreate, canDuplicate, canUpload, onCreate, onDuplicate, onUpload }: QuickActionsProps): JSX.Element {
  return (
    <section className="workspace-admin-side-card">
      <div className="workspace-admin-side-card-head">
        <div>
          <h3>Quick actions</h3>
          <p>Jump into the next admin task faster.</p>
        </div>
      </div>
      <div className="workspace-admin-action-list">
        {actions.map((action) => {
          const Icon = action.icon;
          const disabled = action.id === 'create' ? !canCreate : action.id === 'duplicate' ? !canDuplicate : action.id === 'upload' ? !canUpload : true;
          const handleClick = action.id === 'create' ? onCreate : action.id === 'duplicate' ? onDuplicate : action.id === 'upload' ? onUpload : undefined;
          return (
            <button
              key={action.id}
              className="workspace-admin-action-button"
              type="button"
              onClick={handleClick}
              disabled={disabled}
            >
              <span className="workspace-admin-action-icon"><Icon className="workspace-admin-inline-icon" /></span>
              <span className="workspace-admin-action-copy">
                <strong>{action.label}</strong>
                <small>{action.detail}</small>
              </span>
              <ArrowRightIcon className="workspace-admin-inline-icon workspace-admin-action-arrow" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
