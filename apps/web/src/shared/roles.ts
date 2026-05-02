// apps/web/src/shared/roles.ts
//
// Thin re-export from the contracts package.
// No role logic should be duplicated in apps/web.

import {
  normalizePlatformRole,
  getPlatformRoleLabel,
  resolveProductAccess,
  getPermissionsForRole,
} from '../../../../packages/contracts/src/platform';
import type {
  PlatformRole,
  WorkspaceRole,
  PlatformPermission,
  ProductAccess,
} from '../../../../packages/contracts/src/platform';

export type {
  PlatformRole,
  WorkspaceRole,
  PlatformPermission,
  ProductAccess,
};

export {
  normalizePlatformRole,
  getPlatformRoleLabel,
  resolveProductAccess,
  getPermissionsForRole,
};

export function derivePlatformRoleFromAssignment(role: unknown): PlatformRole {
  return normalizePlatformRole(role);
}
