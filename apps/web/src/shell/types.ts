import type { PlatformRole, ProductAccess } from '../shared/roles';
import type { AuthMeResponse } from '../shared/workspaces';

export interface ShellUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PlatformRole;
  permissions: string[];
  workspace: { id: string; name: string; productAccess: ProductAccess };
}

export function mapAuthMeToShellUser(authMe: AuthMeResponse): ShellUser {
  const displayName =
    String(authMe.user.name ?? '').trim() ||
    String(authMe.user.email).split('@')[0];
  const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);

  return {
    id: authMe.user.id,
    email: authMe.user.email,
    firstName,
    lastName: rest.join(' '),
    role: authMe.user.role,
    permissions: authMe.permissions,
    workspace: {
      id: authMe.workspace?.id ?? '',
      name: authMe.workspace?.name ?? 'Workspace',
      productAccess: authMe.productAccess,
    },
  };
}
