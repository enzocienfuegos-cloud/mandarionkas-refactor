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

const ROLE_BADGE_CLASS: Record<PlatformRole | 'owner', string> = {
  owner: 'bg-violet-100 text-violet-800',
  admin: 'bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]',
  designer: 'bg-emerald-100 text-emerald-800',
  ad_ops: 'bg-fuchsia-100 text-fuchsia-800',
  reviewer: 'bg-[color:var(--dusk-surface-muted)] text-text-muted',
};

export function roleBadge(role: PlatformRole | 'owner') {
  const label = role === 'owner' ? 'Owner' : getPlatformRoleLabel(role);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASS[role]}`}>
      {label}
    </span>
  );
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
  const cls = productAccess.ad_server && productAccess.studio
    ? 'bg-emerald-50 text-emerald-700'
    : productAccess.ad_server
      ? 'bg-fuchsia-50 text-fuchsia-700'
      : 'bg-amber-50 text-[color:var(--dusk-status-warning-fg)]';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {productAccessLabel(productAccess)}
    </span>
  );
}
