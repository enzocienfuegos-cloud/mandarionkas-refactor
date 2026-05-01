export type PlatformRole = 'admin' | 'designer' | 'ad_ops' | 'reviewer';

export function normalizePlatformRole(value: unknown): PlatformRole {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'ad_ops') return 'ad_ops';
  if (role === 'reviewer') return 'reviewer';
  return 'designer';
}

export function getPlatformRoleLabel(role: unknown) {
  switch (normalizePlatformRole(role)) {
    case 'admin':
      return 'Admin';
    case 'ad_ops':
      return 'Ad Ops';
    case 'reviewer':
      return 'Reviewer';
    case 'designer':
    default:
      return 'Designer';
  }
}

export function derivePlatformRoleFromAssignment(input: {
  role?: string | null;
  productAccess?: { ad_server: boolean; studio: boolean } | null;
}): PlatformRole {
  const role = String(input.role || '').trim().toLowerCase();
  const access = input.productAccess ?? { ad_server: true, studio: true };

  if (role === 'owner' || role === 'admin' || role === 'editor') return 'admin';
  if (role === 'viewer' || role === 'reviewer') return 'reviewer';
  if (access.studio !== false && access.ad_server === false) return 'designer';
  if (access.ad_server !== false && access.studio === false) return 'ad_ops';
  return 'designer';
}
