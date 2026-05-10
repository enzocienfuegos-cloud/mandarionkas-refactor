import { Badge } from '../../system';
import { getPlatformRoleLabel, type PlatformRole } from '../../shared/roles';

export type Tab = 'profile' | 'members';

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
}

export interface ProductAccess {
  ad_server: boolean;
  studio: boolean;
}

export interface Member {
  id: string;
  memberId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  platformRole: PlatformRole;
  productAccess: ProductAccess;
  joinedAt: string;
}

export const PLATFORM_ROLES: PlatformRole[] = ['admin', 'designer', 'ad_ops', 'reviewer'];

export const PLATFORM_ROLE_PRODUCT_ACCESS: Record<PlatformRole, ProductAccess> = {
  admin: { ad_server: true, studio: true },
  designer: { ad_server: false, studio: true },
  ad_ops: { ad_server: true, studio: false },
  reviewer: { ad_server: true, studio: true },
};

const ROLE_BADGE_TONE: Record<PlatformRole | 'owner', React.ComponentProps<typeof Badge>['tone']> = {
  owner: 'brand',
  admin: 'info',
  designer: 'success',
  ad_ops: 'brand',
  reviewer: 'neutral',
};

export function roleBadge(role: PlatformRole | 'owner') {
  const label = role === 'owner' ? 'Owner' : getPlatformRoleLabel(role);
  return <Badge tone={ROLE_BADGE_TONE[role]} size="sm">{label}</Badge>;
}

export function productAccessLabel(productAccess: ProductAccess) {
  if (productAccess.ad_server && productAccess.studio) return 'Ad Server + Studio';
  if (productAccess.ad_server) return 'Ad Server only';
  if (productAccess.studio) return 'Studio only';
  return 'No product access';
}

export function normalizeWorkspace(payload: any): Workspace | null {
  const source = payload?.workspace ?? payload;
  if (!source?.id) return null;
  return {
    id: String(source.id),
    name: String(source.name ?? 'Workspace'),
    plan: String(source.plan ?? 'free'),
    createdAt: String(source.createdAt ?? source.created_at ?? ''),
  };
}

export function getWorkspaceRoleForPlatformRole(role: PlatformRole): Member['role'] {
  if (role === 'admin') return 'admin';
  if (role === 'reviewer') return 'viewer';
  return 'member';
}

export function normalizeProductAccess(raw: any, fallbackRole: PlatformRole): ProductAccess {
  if (raw && typeof raw === 'object') {
    return {
      ad_server: raw.ad_server !== false,
      studio: raw.studio !== false,
    };
  }
  return PLATFORM_ROLE_PRODUCT_ACCESS[fallbackRole];
}

export function derivePlatformRole(raw: any, workspaceRole: Member['role'], productAccess: ProductAccess): PlatformRole {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'admin' || value === 'designer' || value === 'ad_ops' || value === 'reviewer') {
    return value as PlatformRole;
  }
  if (workspaceRole === 'owner' || workspaceRole === 'admin') return 'admin';
  if (workspaceRole === 'viewer') return 'reviewer';
  if (productAccess.ad_server && !productAccess.studio) return 'ad_ops';
  return 'designer';
}

export function normalizeMember(raw: any): Member {
  const displayName = String(raw?.display_name ?? raw?.displayName ?? raw?.email ?? '').trim();
  const [firstName = '', ...rest] = displayName.split(/\s+/).filter(Boolean);
  const role = (['owner', 'admin', 'member', 'viewer'].includes(raw?.role) ? raw.role : 'member') as Member['role'];
  const productAccess = normalizeProductAccess(raw?.productAccess ?? raw?.product_access, role === 'owner' ? 'admin' : 'designer');
  const platformRole = derivePlatformRole(raw?.platformRole ?? raw?.platform_role, role, productAccess);
  return {
    id: String(raw?.user_id ?? raw?.userId ?? raw?.id ?? ''),
    memberId: String(raw?.memberId ?? raw?.id ?? ''),
    email: String(raw?.email ?? ''),
    firstName,
    lastName: rest.join(' '),
    role,
    platformRole,
    productAccess,
    joinedAt: String(raw?.joined_at ?? raw?.joinedAt ?? raw?.invited_at ?? raw?.invitedAt ?? ''),
  };
}

export function ProductAccessBadge({ productAccess }: { productAccess: ProductAccess }) {
  const tone: React.ComponentProps<typeof Badge>['tone'] = productAccess.ad_server && productAccess.studio
    ? 'success'
    : productAccess.ad_server
      ? 'brand'
      : 'warning';
  return <Badge tone={tone} size="sm">{productAccessLabel(productAccess)}</Badge>;
}
