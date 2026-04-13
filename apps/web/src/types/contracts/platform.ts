export type UserRole = 'admin' | 'editor' | 'reviewer';
export type WorkspaceRole = 'owner' | 'editor' | 'reviewer';
export type SessionPersistenceMode = 'local' | 'session';

export type PlatformPermission =
  | 'clients:create'
  | 'clients:update'
  | 'clients:invite'
  | 'clients:manage-members'
  | 'projects:create'
  | 'projects:view-client'
  | 'projects:save'
  | 'projects:delete'
  | 'projects:share-client'
  | 'assets:create'
  | 'assets:view-client'
  | 'assets:update'
  | 'assets:delete'
  | 'assets:manage-client'
  | 'brandkits:manage'
  | 'release:manage';
