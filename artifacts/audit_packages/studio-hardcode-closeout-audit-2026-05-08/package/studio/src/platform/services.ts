import { hasPermission } from './permissions';
import { getPlatformAuthProvider } from './providers';
import { getPlatformState } from './state';
import { usePlatformStore } from './store';
import { addBrandToClient, createClient, inviteMember, setActiveClient, workspaceRole } from './workspace-service';
import type { BrandKit, ClientWorkspace, PlatformPermission, PlatformState, WorkspaceRole } from './types';
import type { PlatformLoginResult } from './provider';

export type PlatformServices = {
  getSnapshot(): PlatformState;
  hasPermission(permission: PlatformPermission, snapshot?: PlatformState): boolean;
  useSnapshot(): PlatformState;
  usePermission(permission: PlatformPermission): boolean;
  login(email: string, password: string, options?: { remember?: boolean }): Promise<PlatformLoginResult>;
  logout(): Promise<void>;
  setActiveClient(clientId: string): Promise<void>;
  createClient(name: string): Promise<ClientWorkspace | null>;
  addBrandToClient(clientId: string, name: string, primaryColor: string): Promise<BrandKit | null>;
  inviteMember(clientId: string, email: string, role: WorkspaceRole): Promise<{ ok: boolean; message?: string }>;
  workspaceRole(clientId?: string): WorkspaceRole | undefined;
};

function createDefaultPlatformServices(): PlatformServices {
  return {
    getSnapshot() {
      return getPlatformState();
    },
    hasPermission(permission, snapshot) {
      return hasPermission(permission, snapshot);
    },
    useSnapshot() {
      return usePlatformStore((state) => state);
    },
    usePermission(permission) {
      return usePlatformStore((state) => state.session.permissions.includes(permission));
    },
    async login(email, password, options) {
      return getPlatformAuthProvider().login(email, password, options);
    },
    async logout() {
      await getPlatformAuthProvider().logout();
    },
    async setActiveClient(clientId) {
      await setActiveClient(clientId);
    },
    async createClient(name) {
      return createClient(name);
    },
    async addBrandToClient(clientId, name, primaryColor) {
      return addBrandToClient(clientId, name, primaryColor);
    },
    async inviteMember(clientId, email, role) {
      return inviteMember(clientId, email, role);
    },
    workspaceRole(clientId) {
      return workspaceRole(clientId);
    },
  };
}

let services: PlatformServices = createDefaultPlatformServices();

export function configurePlatformServices(nextServices: PlatformServices): void {
  services = nextServices;
}

export function getPlatformServices(): PlatformServices {
  return services;
}

export function resetPlatformServices(): void {
  services = createDefaultPlatformServices();
}
