// packages/contracts/src/platform.ts
//
// Single source of truth for roles, permissions, and product access.
//
// Design rules:
//   - PlatformRole is authoritative. productAccess is a workspace-level
//     restriction that can only narrow access, never expand it.
//   - WorkspaceRole describes the membership level within a client workspace.
//   - PlatformPermission is a fine-grained capability that the backend
//     computes from PlatformRole and emits in the session payload.
//   - No component, guard, or hook may infer access from raw strings.
//     Use the helpers below.

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/**
 * Platform-level identity role stored on the users table.
 * Maps directly to migration 0021_platform_role_vocabulary.sql.
 */
export type PlatformRole = 'admin' | 'designer' | 'ad_ops' | 'reviewer';

/**
 * @deprecated Use PlatformRole. Kept for backward-compat until all consumers
 * are migrated.
 */
export type UserRole = PlatformRole;

/**
 * Membership role within a client workspace (workspace_members table).
 * Maps to migration 0012_workspace_role_expansion.sql.
 */
export type WorkspaceRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'viewer'
  | 'editor'
  | 'reviewer';

export type SessionPersistenceMode = 'local' | 'session';

// ---------------------------------------------------------------------------
// Product access
// ---------------------------------------------------------------------------

export interface ProductAccess {
  ad_server: boolean;
  studio: boolean;
}

/**
 * The unrestricted default: both products enabled.
 * Used as fallback when a workspace row has no product_access column value.
 */
export const DEFAULT_PRODUCT_ACCESS: ProductAccess = {
  ad_server: true,
  studio: true,
} as const;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type PlatformPermission =
  // Client / workspace management
  | 'clients:create'
  | 'clients:update'
  | 'clients:invite'
  | 'clients:manage-members'
  // Projects
  | 'projects:create'
  | 'projects:view-client'
  | 'projects:save'
  | 'projects:delete'
  | 'projects:share-client'
  // Assets
  | 'assets:create'
  | 'assets:view-client'
  | 'assets:update'
  | 'assets:delete'
  | 'assets:manage-client'
  // Brand & release
  | 'brandkits:manage'
  | 'release:manage'
  // System
  | 'audit:read'
  // Product entitlements (explicit, not inferred from productAccess)
  | 'adserver:access'
  | 'studio:access';

// ---------------------------------------------------------------------------
// Role → permission matrix
// ---------------------------------------------------------------------------

/**
 * Canonical mapping. Used by the backend auth service and the frontend
 * role helpers. Both must stay in sync with this definition.
 */
export const ROLE_PERMISSION_MATRIX: Record<PlatformRole, PlatformPermission[]> = {
  admin: [
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
    'audit:read',
    'adserver:access',
    'studio:access',
  ],
  ad_ops: [
    'projects:view-client',
    'assets:view-client',
    'audit:read',
    'adserver:access',
  ],
  designer: [
    'projects:create',
    'projects:view-client',
    'projects:save',
    'projects:share-client',
    'assets:create',
    'assets:view-client',
    'assets:update',
    'brandkits:manage',
    'clients:invite',
    'studio:access',
  ],
  reviewer: [
    'projects:view-client',
    'assets:view-client',
    'adserver:access',
    'studio:access',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalises any raw role string to a valid PlatformRole.
 * Falls back to 'reviewer' (least privilege) for unknown values.
 */
export function normalizePlatformRole(value: unknown): PlatformRole {
  const role = String(value ?? '').trim().toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'ad_ops') return 'ad_ops';
  if (role === 'designer') return 'designer';
  if (role === 'reviewer') return 'reviewer';
  return 'reviewer';
}

/**
 * Returns the canonical permissions for a given role.
 * Always returns a new array — safe to spread / mutate.
 */
export function getPermissionsForRole(role: PlatformRole): PlatformPermission[] {
  return [...(ROLE_PERMISSION_MATRIX[role] ?? ROLE_PERMISSION_MATRIX.reviewer)];
}

/**
 * Derives the effective product access for a user given their platform role
 * and the optional workspace-level override.
 *
 * Rule: platformRole is the ceiling. workspaceAccess can only restrict further.
 */
export function resolveProductAccess(
  role: PlatformRole,
  workspaceAccess: ProductAccess | null | undefined,
): ProductAccess {
  // Compute the role-level ceiling
  const perms = ROLE_PERMISSION_MATRIX[role];
  const roleAdServer = perms.includes('adserver:access');
  const roleStudio = perms.includes('studio:access');

  // Apply workspace-level narrowing (can only reduce, never expand)
  const wsAccess = workspaceAccess ?? DEFAULT_PRODUCT_ACCESS;

  return {
    ad_server: roleAdServer && wsAccess.ad_server !== false,
    studio: roleStudio && wsAccess.studio !== false,
  };
}

/**
 * Human-readable label for display in UI.
 */
export function getPlatformRoleLabel(role: unknown): string {
  switch (normalizePlatformRole(role)) {
    case 'admin': return 'Admin';
    case 'ad_ops': return 'Ad Ops';
    case 'designer': return 'Designer';
    case 'reviewer': return 'Reviewer';
  }
}
