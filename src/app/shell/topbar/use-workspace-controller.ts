import { useMemo, useState } from 'react';
import brandingDefaults from '../../../../config/branding-defaults.json';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { usePlatformActions, usePlatformPermission } from '../../../platform/runtime';
import type { TopBarStudioSnapshot, WorkspaceController } from './top-bar-types';

export function useWorkspaceController(snapshot: TopBarStudioSnapshot): WorkspaceController {
  const [newClientName, setNewClientName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandColor, setNewBrandColor] = useState(brandingDefaults.brandColor);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'reviewer'>('editor');

  const platform = usePlatformActions();
  const documentActions = useDocumentActions();
  const canCreateClient = usePlatformPermission('clients:create');
  const canInviteClients = usePlatformPermission('clients:invite');
  const canManageBrandkits = usePlatformPermission('brandkits:manage');
  const canCreateProjects = usePlatformPermission('projects:create');
  const canSaveProjects = usePlatformPermission('projects:save');
  const canDeleteProjects = usePlatformPermission('projects:delete');

  const activeClientId = platform.state.session.activeClientId;
  const clients = platform.state.clients;
  const currentUser = platform.state.session.currentUser;
  const activeClient = clients.find((client) => client.id === activeClientId);
  const workspaceRole = platform.workspaceRole(activeClientId);
  const visibleClients = useMemo(
    () => clients.filter((client) => !currentUser || client.memberUserIds.includes(currentUser.id) || client.ownerUserId === currentUser.id),
    [clients, currentUser],
  );

  async function handleActiveClientChange(clientId: string): Promise<void> {
    await platform.setActiveClient(clientId);
  }

  function handleLogout(): void {
    platform.logout();
  }

  async function handleCreateClient(): Promise<void> {
    const client = await platform.createClient(newClientName);
    if (!client) return;
    setNewClientName('');
  }

  async function handleCreateBrand(): Promise<void> {
    if (!activeClientId) return;
    const brand = await platform.addBrandToClient(activeClientId, newBrandName, newBrandColor);
    if (!brand) return;
    documentActions.updatePlatformMetadata({ brandId: brand.id, brandName: brand.name, clientId: activeClientId, clientName: activeClient?.name });
    setNewBrandName('');
  }

  async function handleInviteMember(): Promise<void> {
    if (!activeClientId) return;
    const result = await platform.inviteMember(activeClientId, inviteEmail, inviteRole);
    if (!result.ok) return;
    setInviteEmail('');
  }

  return {
    currentUser,
    activeClientId,
    activeClient,
    clients,
    visibleClients,
    permissions: platform.state.session.permissions,
    auditCount: platform.state.auditLog.length,
    sessionExpiresAt: platform.state.session.expiresAt,
    sessionPersistenceMode: platform.state.session.persistenceMode,
    workspaceRole,
    canCreateClient,
    canInviteClients,
    canManageBrandkits,
    canCreateProjects,
    canSaveProjects,
    canDeleteProjects,
    newClientName,
    setNewClientName,
    newBrandName,
    setNewBrandName,
    newBrandColor,
    setNewBrandColor,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    handleActiveClientChange,
    handleCreateClient,
    handleCreateBrand,
    handleInviteMember,
    handleLogout,
  };
}
