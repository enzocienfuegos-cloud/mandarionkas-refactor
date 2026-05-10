import { useSyncExternalStore } from 'react';
import { login, logout } from './auth-service';
import { removeBrand, updateBrand } from './brand-service';
import { getRolePermissions, hasPermission } from './permissions';
import { getPlatformState, subscribePlatformState } from './state';
import {
  addBrandToClient,
  createClient,
  inviteMember,
  setActiveClient,
  workspaceRole,
} from './workspace-service';
import type {
  BrandKit,
  ClientWorkspace,
  PlatformPermission,
  PlatformState,
  SessionPersistenceMode,
  UserRole,
  WorkspaceRole,
} from './types';

export { getRolePermissions, hasPermission };

export const platformStore = {
  getState(): PlatformState {
    return getPlatformState();
  },
  subscribe(listener: () => void): () => void {
    return subscribePlatformState(listener);
  },
  login,
  logout,
  setActiveClient,
  createClient,
  addBrandToClient,
  updateBrand,
  removeBrand,
  inviteMember,
  workspaceRole,
} satisfies {
  getState(): PlatformState;
  subscribe(listener: () => void): () => void;
  login(email: string, password: string, options?: { remember?: boolean }): Promise<{ ok: boolean; message?: string }>;
  logout(): Promise<void>;
  setActiveClient(clientId: string): Promise<void>;
  createClient(name: string): Promise<ClientWorkspace | null>;
  addBrandToClient(clientId: string, name: string, primaryColor: string): Promise<BrandKit | null>;
  updateBrand(clientId: string, brandId: string, patch: Partial<BrandKit>): void;
  removeBrand(clientId: string, brandId: string): void;
  inviteMember(clientId: string, email: string, role: WorkspaceRole): Promise<{ ok: boolean; message?: string }>;
  workspaceRole(clientId?: string): WorkspaceRole | undefined;
};

export function usePlatformStore<T>(selector: (state: PlatformState) => T): T {
  const snapshot = useSyncExternalStore(platformStore.subscribe, platformStore.getState, platformStore.getState);
  return selector(snapshot);
}

export type { PlatformPermission, SessionPersistenceMode, UserRole };
