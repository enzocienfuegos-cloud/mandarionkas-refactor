import type { PlatformPermission, WorkspaceRole } from './types';

const ROLE_PERMISSIONS: Record<WorkspaceRole, PlatformPermission[]> = {
  owner: [
    'clients:create',
    'clients:update',
    'clients:invite',
    'clients:manage-members',
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:delete',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'assets:delete',
    'assets:manage-client',
    'brandkits:manage',
    'release:manage',
  ],
  editor: [
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'brandkits:manage',
    'clients:invite',
  ],
  reviewer: ['projects:view-client', 'assets:view-client'],
};

export function getRolePermissions(role: WorkspaceRole): PlatformPermission[] {
  return ROLE_PERMISSIONS[role];
}
