import { appendAuditEntry, createAuditEntry, createBrandKit } from './repository';
import { hasPermission } from './permissions';
import { getPlatformState, updatePlatformState } from './state';
import type { BrandKit } from './types';

export function addBrandToClient(clientId: string, name: string, primaryColor: string): BrandKit | null {
  const state = getPlatformState();
  if (!hasPermission('brandkits:manage', state) || !name.trim()) return null;
  const brand = createBrandKit(name.trim(), primaryColor);
  const clientName = state.clients.find((client) => client.id === clientId)?.name;
  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        clients: current.clients.map((client) =>
          client.id === clientId ? { ...client, brands: [...(client.brands ?? []), brand] } : client,
        ),
      },
      createAuditEntry({
        action: 'brand.create',
        target: 'brand',
        actor: current.session.currentUser,
        clientId,
        targetId: brand.id,
        summary: `${current.session.currentUser?.name ?? 'User'} created brand ${brand.name}${clientName ? ` for ${clientName}` : ''}`,
      }),
    ),
  );
  return brand;
}

export function updateBrand(clientId: string, brandId: string, patch: Partial<BrandKit>): void {
  const state = getPlatformState();
  if (!hasPermission('brandkits:manage', state)) return;
  const currentBrand = state.clients.find((client) => client.id === clientId)?.brands?.find((brand) => brand.id === brandId);
  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        clients: current.clients.map((client) =>
          client.id === clientId
            ? {
                ...client,
                brands: (client.brands ?? []).map((brand) => (brand.id === brandId ? { ...brand, ...patch } : brand)),
              }
            : client,
        ),
      },
      createAuditEntry({
        action: 'brand.update',
        target: 'brand',
        actor: current.session.currentUser,
        clientId,
        targetId: brandId,
        summary: `${current.session.currentUser?.name ?? 'User'} updated brand ${patch.name ?? currentBrand?.name ?? brandId}`,
      }),
    ),
  );
}

export function removeBrand(clientId: string, brandId: string): void {
  const state = getPlatformState();
  if (!hasPermission('brandkits:manage', state)) return;
  const currentBrand = state.clients.find((client) => client.id === clientId)?.brands?.find((brand) => brand.id === brandId);
  updatePlatformState((current) =>
    appendAuditEntry(
      {
        ...current,
        clients: current.clients.map((client) =>
          client.id === clientId
            ? {
                ...client,
                brands: (client.brands ?? []).filter((brand) => brand.id !== brandId),
              }
            : client,
        ),
      },
      createAuditEntry({
        action: 'brand.remove',
        target: 'brand',
        actor: current.session.currentUser,
        clientId,
        targetId: brandId,
        summary: `${current.session.currentUser?.name ?? 'User'} removed brand ${currentBrand?.name ?? brandId}`,
      }),
    ),
  );
}
