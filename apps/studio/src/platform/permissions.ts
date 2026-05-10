import { getPlatformState } from './state';
import { getRolePermissions } from './role-permissions';
import type { PlatformPermission, PlatformState } from './types';

export { getRolePermissions };

export function hasPermission(permission: PlatformPermission, snapshot: PlatformState = getPlatformState()): boolean {
  return snapshot.session.permissions.includes(permission);
}
