import { appendAuditEntry, createAuditEntry } from './repository';
import { getPlatformState, updatePlatformState } from './state';
import { requestCreateBrand, requestCreateClient, requestInviteMember, requestSetActiveClient } from './api';
import type { ClientWorkspace, PlatformAuditEntry, WorkspaceRole } from './types';

function applyClientsPatch(input: {
  clients: ClientWorkspace[];
  activeClientId?: string;
  audit?: PlatformAuditEntry;
}): void {
  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        clients: input.clients,
        session: {
          ...current.session,
          activeClientId: input.activeClientId ?? current.session.activeClientId,
        },
      },
      input.audit ?? createAuditEntry({
        action: 'client.update',
        target: 'client',
        actor: current.session.currentUser,
        clientId: input.activeClientId ?? current.session.activeClientId,
        summary: 'Workspace state synced from API',
      }),
    ),
  );
}

function getClient(clientId?: string): ClientWorkspace | undefined {
  return getPlatformState().clients.find((client) => client.id === clientId);
}

export function currentWorkspaceRole(clientId?: string): WorkspaceRole | undefined {
  const state = getPlatformState();
  const userId = state.session.currentUser?.id;
  if (!userId) return undefined;
  const client = getClient(clientId ?? state.session.activeClientId);
  if (!client) return undefined;
  if (client.ownerUserId === userId) return 'owner';
  return client.members?.find((member) => member.userId === userId)?.role;
}

export async function setActiveClient(clientId: string): Promise<void> {
  const response = await requestSetActiveClient({ clientId });
  if (!response?.ok) return;
  applyClientsPatch({
    clients: response.clients,
    activeClientId: response.activeClientId,
    audit: createAuditEntry({
      action: 'client.update',
      target: 'client',
      actor: getPlatformState().session.currentUser,
      clientId: response.activeClientId,
      targetId: response.activeClientId,
      summary: `${getPlatformState().session.currentUser?.name ?? 'User'} switched active client`,
    }),
  });
}

export async function createClient(name: string): Promise<ClientWorkspace | null> {
  const response = await requestCreateClient({ name: name.trim() });
  if (!response?.ok) return null;
  applyClientsPatch({
    clients: response.clients,
    activeClientId: response.activeClientId,
    audit: createAuditEntry({
      action: 'client.create',
      target: 'client',
      actor: getPlatformState().session.currentUser,
      clientId: response.client.id,
      targetId: response.client.id,
      summary: `${getPlatformState().session.currentUser?.name ?? 'User'} created workspace ${response.client.name}`,
    }),
  });
  return response.client;
}

export async function addBrandToClient(clientId: string, name: string, primaryColor: string) {
  const response = await requestCreateBrand(clientId, { name, primaryColor });
  if (!response?.ok) return null;
  applyClientsPatch({
    clients: response.clients,
    activeClientId: clientId,
    audit: createAuditEntry({
      action: 'brand.create',
      target: 'brand',
      actor: getPlatformState().session.currentUser,
      clientId,
      targetId: response.client.brands?.[0]?.id,
      summary: `${getPlatformState().session.currentUser?.name ?? 'User'} created brand ${name}`,
    }),
  });
  return response.client.brands?.find((brand) => brand.name === name) ?? null;
}

export async function inviteMember(clientId: string, email: string, role: WorkspaceRole): Promise<{ ok: boolean; message?: string }> {
  const response = await requestInviteMember(clientId, { email, role });
  if (!response?.ok || !response.clients) {
    return { ok: false, message: response?.message ?? 'Invite failed.' };
  }
  applyClientsPatch({
    clients: response.clients,
    activeClientId: clientId,
    audit: createAuditEntry({
      action: 'client.member.invite',
      target: 'member',
      actor: getPlatformState().session.currentUser,
      clientId,
      summary: response.message ?? `${getPlatformState().session.currentUser?.name ?? 'User'} invited ${email}`,
    }),
  });
  return { ok: true, message: response.message };
}

export function workspaceRole(clientId?: string): WorkspaceRole | undefined {
  return currentWorkspaceRole(clientId);
}
