import type { JSX } from 'react';
import { BellIcon, ChevronDownIcon, PlusIcon, SearchIcon } from './icons';

type WorkspaceOption = {
  id: string;
  name: string;
};

type WorkspaceHeaderProps = {
  activeWorkspaceId?: string;
  currentWorkspaceName: string;
  currentUserName: string;
  currentUserEmail: string;
  notificationCount: number;
  search: string;
  workspaces: WorkspaceOption[];
  onWorkspaceChange(workspaceId: string): void;
  onSearchChange(value: string): void;
  onCreateProject(): void;
};

export function WorkspaceHeader({
  activeWorkspaceId,
  currentWorkspaceName,
  currentUserName,
  currentUserEmail,
  notificationCount,
  search,
  workspaces,
  onWorkspaceChange,
  onSearchChange,
  onCreateProject,
}: WorkspaceHeaderProps): JSX.Element {
  return (
    <>
      <div className="workspace-admin-toolbar">
        <div className="workspace-admin-toolbar-left">
          <div className="workspace-admin-breadcrumb">Current workspace</div>
          <div className="workspace-admin-toolbar-select-shell">
            <select
              value={activeWorkspaceId ?? ''}
              onChange={(event) => onWorkspaceChange(event.target.value)}
              className="workspace-admin-toolbar-select"
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))}
            </select>
            <ChevronDownIcon className="workspace-admin-inline-icon workspace-admin-select-chevron" />
          </div>
        </div>
        <div className="workspace-admin-toolbar-center">
          <label className="workspace-admin-search-shell">
            <SearchIcon className="workspace-admin-inline-icon workspace-admin-search-icon" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search projects, folders, templates..."
              type="search"
            />
            <span className="workspace-admin-search-hint">⌘K</span>
          </label>
        </div>
        <div className="workspace-admin-toolbar-right">
          <button className="workspace-admin-notification-button" type="button">
            <BellIcon className="workspace-admin-inline-icon" />
            {notificationCount > 0 ? <span className="workspace-admin-notification-badge">{notificationCount}</span> : null}
          </button>
          <div className="workspace-admin-user-chip">
            <span className="workspace-admin-user-avatar">{currentUserName.split(' ').map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase()}</span>
            <div className="workspace-admin-user-copy">
              <strong>{currentUserName}</strong>
              <span>{currentUserEmail}</span>
            </div>
            <ChevronDownIcon className="workspace-admin-inline-icon" />
          </div>
          <button className="workspace-admin-primary-button" type="button" onClick={onCreateProject}>
            <PlusIcon className="workspace-admin-inline-icon" />
            New project
          </button>
        </div>
      </div>

      <header className="workspace-admin-page-header">
        <div className="workspace-admin-page-header-copy">
          <h1>Good morning, {currentUserName.split(' ')[0] || 'Admin'}</h1>
          <p>Here’s what’s happening in {currentWorkspaceName}.</p>
        </div>
      </header>
    </>
  );
}
