import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { ColorControl } from '../../shared/ui/ColorControl';
import { IconButton } from '../../shared/ui/IconButton';
import { useToast } from '../../shared/ui/ToastProvider';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { usePlatformActions } from '../runtime';
import { platformStore } from '../store';
import type { BrandKit, ClientWorkspace } from '../types';

type PlatformBrandKitModalProps = {
  open: boolean;
  activeClient?: ClientWorkspace;
  canManageBrandkits?: boolean;
  onClose(): void;
};

type BrandKitDraft = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string;
};

function buildEmptyDraft(activeClient?: ClientWorkspace): BrandKitDraft {
  return {
    name: activeClient ? `${activeClient.name} Core` : '',
    primaryColor: activeClient?.brandColor ?? '#6f3cff',
    secondaryColor: '',
    accentColor: '',
    fontFamily: '',
    logoUrl: '',
  };
}

function buildDraftFromBrand(brand?: BrandKit, activeClient?: ClientWorkspace): BrandKitDraft {
  if (!brand) return buildEmptyDraft(activeClient);
  return {
    name: brand.name ?? '',
    primaryColor: brand.primaryColor ?? activeClient?.brandColor ?? '#6f3cff',
    secondaryColor: brand.secondaryColor ?? '',
    accentColor: brand.accentColor ?? '',
    fontFamily: brand.fontFamily ?? '',
    logoUrl: brand.logoUrl ?? '',
  };
}

function resolvePalette(draft: BrandKitDraft): string[] {
  return Array.from(
    new Set(
      [draft.primaryColor, draft.secondaryColor, draft.accentColor].filter((value): value is string => Boolean(value.trim())),
    ),
  ).slice(0, 4);
}

export function PlatformBrandKitModal({
  open,
  activeClient,
  canManageBrandkits = false,
  onClose,
}: PlatformBrandKitModalProps): JSX.Element | null {
  const { pushToast } = useToast();
  const platform = usePlatformActions();
  const [selectedBrandId, setSelectedBrandId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<BrandKitDraft>(() => buildEmptyDraft(activeClient));
  const [submitting, setSubmitting] = useState(false);
  const brands = activeClient?.brands ?? [];

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId),
    [brands, selectedBrandId],
  );
  const palette = useMemo(() => resolvePalette(draft), [draft]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const firstBrand = activeClient?.brands?.[0];
    if (firstBrand) {
      setSelectedBrandId(firstBrand.id);
      setDraft(buildDraftFromBrand(firstBrand, activeClient));
      return;
    }
    setSelectedBrandId('new');
    setDraft(buildEmptyDraft(activeClient));
  }, [activeClient, open]);

  useEffect(() => {
    if (!open) return;
    if (selectedBrandId === 'new') {
      setDraft(buildEmptyDraft(activeClient));
      return;
    }
    setDraft(buildDraftFromBrand(selectedBrand, activeClient));
  }, [activeClient, open, selectedBrand, selectedBrandId]);

  if (!open || !activeClient) return null;
  const client = activeClient;

  function updateDraft(patch: Partial<BrandKitDraft>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave(): Promise<void> {
    const nextName = draft.name.trim();
    const nextPrimary = draft.primaryColor.trim();
    if (!nextName || !nextPrimary) {
      pushToast({
        title: 'Brand kit incomplete',
        description: 'Name and primary color are required.',
        tone: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (selectedBrandId && selectedBrandId !== 'new') {
        platformStore.updateBrand(client.id, selectedBrandId, {
          name: nextName,
          primaryColor: nextPrimary,
          secondaryColor: draft.secondaryColor.trim() || undefined,
          accentColor: draft.accentColor.trim() || undefined,
          fontFamily: draft.fontFamily.trim() || undefined,
          logoUrl: draft.logoUrl.trim() || undefined,
        });
        pushToast({
          title: 'Brand kit updated',
          description: `${nextName} is now updated for ${client.name}.`,
          tone: 'success',
        });
        return;
      }

      const created = await platform.addBrandToClient(client.id, nextName, nextPrimary);
      if (!created) {
        pushToast({
          title: 'Could not create brand kit',
          description: 'Try again with a valid name and color.',
          tone: 'danger',
        });
        return;
      }
      platformStore.updateBrand(client.id, created.id, {
        secondaryColor: draft.secondaryColor.trim() || undefined,
        accentColor: draft.accentColor.trim() || undefined,
        fontFamily: draft.fontFamily.trim() || undefined,
        logoUrl: draft.logoUrl.trim() || undefined,
      });
      setSelectedBrandId(created.id);
      pushToast({
        title: 'Brand kit created',
        description: `${created.name} is now available for ${client.name}.`,
        tone: 'success',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(): void {
    if (!selectedBrand || !client.brands?.length) return;
    platformStore.removeBrand(client.id, selectedBrand.id);
    const nextFirstBrand = client.brands.filter((brand) => brand.id !== selectedBrand.id)[0];
    if (nextFirstBrand) {
      setSelectedBrandId(nextFirstBrand.id);
      setDraft(buildDraftFromBrand(nextFirstBrand, client));
    } else {
      setSelectedBrandId('new');
      setDraft(buildEmptyDraft(client));
    }
    pushToast({
      title: 'Brand kit removed',
      description: `${selectedBrand.name} was removed from ${client.name}.`,
      tone: 'success',
    });
  }

  return (
    <div className="platform-brand-kit-modal-shell" role="presentation" onClick={onClose}>
      <div
        className="platform-brand-kit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-brand-kit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="platform-brand-kit-modal__header">
          <div>
            <div className="workspace-hub-kicker">Brand Kit</div>
            <h2 id="platform-brand-kit-title">{client.name} brand system</h2>
            <p>Manage palette, typography, and reusable brand definitions for this client outside the editor.</p>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            label="Close brand kit modal"
            showTooltip={false}
            icon={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          />
        </header>

        <div className="platform-brand-kit-modal__body">
          <aside className="platform-brand-kit-modal__list">
            <div className="platform-brand-kit-modal__list-head">
              <span className="pill">{brands.length} brand kits</span>
              <Button
                variant="ghost"
                size="sm"
                className="compact-action"
                iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />}
                onClick={() => setSelectedBrandId('new')}
                disabled={!canManageBrandkits}
              >
                New
              </Button>
            </div>
            <div className="platform-brand-kit-modal__list-grid">
              {brands.map((brand) => {
                const swatches = Array.from(
                  new Set([brand.primaryColor, brand.secondaryColor, brand.accentColor].filter((value): value is string => Boolean(value))),
                );
                return (
                  <button
                    key={brand.id}
                    type="button"
                    className={`platform-brand-kit-card ${selectedBrandId === brand.id ? 'is-selected' : ''}`.trim()}
                    onClick={() => setSelectedBrandId(brand.id)}
                    disabled={!canManageBrandkits && selectedBrandId !== brand.id}
                  >
                    <div className="platform-brand-kit-card__header">
                      <strong>{brand.name}</strong>
                      {brand.fontFamily ? <span className="pill">{brand.fontFamily}</span> : null}
                    </div>
                    <div className="platform-brand-kit-card__swatches" aria-hidden="true">
                      {swatches.length > 0 ? (
                        swatches.map((color) => (
                          <svg key={color} viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                            <circle cx="8" cy="8" r="7" fill={color} />
                          </svg>
                        ))
                      ) : (
                        <small>No palette</small>
                      )}
                    </div>
                  </button>
                );
              })}
              {!brands.length ? (
                <div className="platform-brand-kit-modal__empty">
                  <strong>No brand kits yet</strong>
                  <p>Create the first reusable brand system for this client.</p>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="platform-brand-kit-modal__editor">
            <div className="platform-brand-kit-modal__preview">
              <div className="platform-brand-kit-modal__preview-surface">
                <div className="platform-brand-kit-modal__preview-eyebrow">Preview</div>
                <strong>{draft.name.trim() || 'Untitled brand kit'}</strong>
                <span>{draft.fontFamily.trim() || 'Define a font family'}</span>
                <div className="platform-brand-kit-modal__preview-swatches" aria-hidden="true">
                  {palette.length > 0 ? (
                    palette.map((color) => (
                      <svg key={color} viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                        <circle cx="8" cy="8" r="7" fill={color} />
                      </svg>
                    ))
                  ) : (
                    <small>No palette yet</small>
                  )}
                </div>
              </div>
            </div>

            <fieldset className="platform-brand-kit-modal__fields" disabled={!canManageBrandkits}>
              <div className="fields-grid">
                <div>
                  <label>Name</label>
                  <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Retail Core" />
                </div>
                <div>
                  <label>Font family</label>
                  <input value={draft.fontFamily} onChange={(event) => updateDraft({ fontFamily: event.target.value })} placeholder="Inter, system-ui, sans-serif" />
                </div>
              </div>

              <div className="platform-brand-kit-modal__color-grid">
                <ColorControl label="Primary" value={draft.primaryColor} fallback="#6f3cff" onChange={(value) => updateDraft({ primaryColor: value })} />
                <ColorControl label="Secondary" value={draft.secondaryColor} fallback="#2563eb" onChange={(value) => updateDraft({ secondaryColor: value })} />
                <ColorControl label="Accent" value={draft.accentColor} fallback="#ec4899" onChange={(value) => updateDraft({ accentColor: value })} />
              </div>

              <div>
                <label>Logo URL</label>
                <input value={draft.logoUrl} onChange={(event) => updateDraft({ logoUrl: event.target.value })} placeholder="https://cdn.example.com/logo.svg" />
              </div>
            </fieldset>
          </section>
        </div>

        <footer className="platform-brand-kit-modal__footer">
          <div className="platform-brand-kit-modal__footer-copy">
            <span className="pill">{client.name}</span>
            <small>Brand kits are stored at the client level and survive across workspace sessions.</small>
          </div>
          <div className="platform-brand-kit-modal__footer-actions">
            {selectedBrand ? (
              <Button variant="danger" size="md" onClick={handleDelete} disabled={submitting || !canManageBrandkits}>
                Remove
              </Button>
            ) : null}
            <Button variant="ghost" size="md" onClick={onClose} disabled={submitting}>
              Close
            </Button>
            <Button variant="primary" size="md" onClick={() => { void handleSave(); }} loading={submitting} disabled={!canManageBrandkits}>
              {selectedBrand ? 'Save changes' : 'Create brand kit'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
