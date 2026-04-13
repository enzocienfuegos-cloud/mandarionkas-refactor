import { getPlatformServices } from './services';
import type { PlatformPermission, PlatformState, WorkspaceRole, ClientWorkspace, BrandKit } from './types';

export type PlatformRepositoryContext = {
  clientId: string;
  ownerUserId: string;
  clientName?: string;
  currentUserRole?: string;
  can(permission: PlatformPermission): boolean;
};

export function getPlatformRepositoryContext(snapshot: PlatformState = getPlatformServices().getSnapshot()): PlatformRepositoryContext {
  const clientId = snapshot.session.activeClientId ?? snapshot.clients[0]?.id ?? 'client_default';
  return {
    clientId,
    ownerUserId: snapshot.session.currentUser?.id ?? 'anonymous',
    clientName: snapshot.clients.find((item) => item.id === clientId)?.name,
    currentUserRole: snapshot.session.currentUser?.role,
    can(permission: PlatformPermission) {
      return getPlatformServices().hasPermission(permission, snapshot);
    },
  };
}

export function usePlatformPermission(permission: PlatformPermission): boolean {
  return getPlatformServices().usePermission(permission);
}

export function usePlatformActions() {
  const services = getPlatformServices();
  const state = services.useSnapshot();
  return {
    state,
    async login(email: string, password: string, options?: { remember?: boolean }) {
      return services.login(email, password, options);
    },
    async setActiveClient(clientId: string) {
      await services.setActiveClient(clientId);
    },
    async createClient(name: string): Promise<ClientWorkspace | null> {
      return services.createClient(name);
    },
    async addBrandToClient(clientId: string, name: string, primaryColor: string): Promise<BrandKit | null> {
      return services.addBrandToClient(clientId, name, primaryColor);
    },
    async inviteMember(clientId: string, email: string, role: WorkspaceRole) {
      return services.inviteMember(clientId, email, role);
    },
    async logout(): Promise<void> {
      await services.logout();
    },
    workspaceRole(clientId?: string): WorkspaceRole | undefined {
      return services.workspaceRole(clientId);
    },
  };
}

export function usePlatformSnapshot() {
  return getPlatformServices().useSnapshot();
}
