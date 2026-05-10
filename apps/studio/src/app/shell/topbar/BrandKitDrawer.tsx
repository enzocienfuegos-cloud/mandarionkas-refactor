import { useEffect } from 'react';
import { Button } from '../../../shared/ui/Button';
import { ColorControl } from '../../../shared/ui/ColorControl';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { useBrandKitController } from './use-brand-kit-controller';

type BrandKitDrawerProps = {
  embedded?: boolean;
  onClose(): void;
};

function numberInputValue(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : '';
}

function formatBrandKitDate(value: string | undefined): string {
  if (!value) return 'Draft';
  return new Date(value).toLocaleDateString();
}

export function BrandKitDrawer({ embedded = false, onClose }: BrandKitDrawerProps): JSX.Element {
  const controller = useBrandKitController();
  const { draft, selectedBrandKit, brandKits } = controller;
  const previewTitle = draft.brandName || draft.name || 'Untitled brand';
  const previewAccent = draft.colors?.accent || 'Set accent color';
  const previewText = draft.colors?.text || 'Set text color';
  const previewBackground = draft.colors?.background || 'Set background';
  const previewHeadingFont = draft.typography?.headingFamily || draft.typography?.fontFamily || 'Heading family';
  const previewBodyFont = draft.typography?.bodyFamily || draft.typography?.fontFamily || 'Body family';
  const previewRadius = draft.radii?.md ?? draft.radii?.lg ?? draft.radii?.sm;

  useEffect(() => {
    if (embedded) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [embedded, onClose]);

  const drawer = (
    <div className={`brand-kit-drawer-card ${embedded ? 'brand-kit-drawer-card--embedded' : ''}`.trim()} onClick={(event) => event.stopPropagation()}>
        <div className="brand-kit-drawer-header">
          <div className="brand-kit-drawer-copy">
            <p className="section-kicker">Brand Kit</p>
            <h2 id="brand-kit-drawer-title">Brand system and document styling</h2>
            <p>Shape the palette, typography, and interaction tone for this document, then apply it in replace or merge mode.</p>
            <div className="brand-kit-drawer-header-pills">
              <span className="pill pill-highlight">{selectedBrandKit ? 'Editing saved kit' : 'Draft from document'}</span>
              <span className="pill">{brandKits.length} kits in workspace</span>
              {controller.activeBrandKitId ? <span className="pill">Applied to current document</span> : null}
            </div>
          </div>
          <div className="brand-kit-drawer-actions">
            <Button variant="ghost" size="sm" onClick={() => controller.startNewDraft()}>
              New draft
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void controller.refresh()} disabled={controller.loading}>
              {controller.loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="ghost" size="sm" iconBefore={<StudioIcon icon={StudioIcons.x} size={14} />} onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="brand-kit-drawer-body">
          <aside className="brand-kit-drawer-list">
            <div className="brand-kit-drawer-toolbar">
              <span className="pill">Library</span>
              {controller.activeBrandKitId ? <span className="pill pill-highlight">Applied</span> : null}
            </div>
            <div className="brand-kit-drawer-list-grid">
              {brandKits.map((brandKit) => (
                <button
                  key={brandKit.id}
                  type="button"
                  className={`brand-kit-card ${controller.selectedBrandKitId === brandKit.id ? 'is-selected' : ''} ${controller.activeBrandKitId === brandKit.id ? 'is-applied' : ''}`.trim()}
                  aria-label={`${brandKit.name}${controller.activeBrandKitId === brandKit.id ? ', currently applied to this document' : ''}`}
                  onClick={() => controller.setSelectedBrandKitId(brandKit.id)}
                >
                  <div className="brand-kit-card__top">
                    <strong>{brandKit.name}</strong>
                    {controller.activeBrandKitId === brandKit.id ? <span className="pill pill-highlight">Active</span> : null}
                  </div>
                  <div className="brand-kit-card__meta">
                    <span>{brandKit.brandName ?? 'Unassigned brand'}</span>
                    <span>{formatBrandKitDate(brandKit.updatedAt)}</span>
                  </div>
                  {brandKit.description ? <p className="brand-kit-card__description">{brandKit.description}</p> : null}
                  <div className="brand-kit-card__swatches">
                    {brandKit.colors?.background ? <span className="brand-kit-card__token">BG {brandKit.colors.background}</span> : null}
                    {brandKit.colors?.accent ? <span className="brand-kit-card__token">AC {brandKit.colors.accent}</span> : null}
                    {brandKit.colors?.text ? <span className="brand-kit-card__token">TX {brandKit.colors.text}</span> : null}
                  </div>
                </button>
              ))}
              {!brandKits.length ? (
                <div className="brand-kit-empty">
                  <strong>No Brand Kits yet</strong>
                  <p>Start from the current document, then save your first reusable kit for this workspace.</p>
                  <Button variant="primary" size="sm" onClick={() => controller.startNewDraft()}>
                    Create from current document
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="brand-kit-drawer-editor">
            <div className="brand-kit-editor-head">
              <div>
                <h3>{selectedBrandKit ? 'Edit Brand Kit' : 'New Brand Kit'}</h3>
                <p>Define the core creative language first: palette, typography, radii, and motion cadence.</p>
              </div>
              {controller.errorMessage ? <span className="pill pill-danger">{controller.errorMessage}</span> : null}
            </div>

            <div className="field-stack">
              <section className="brand-kit-preview-strip" aria-label="Brand Kit preview">
                <article className="brand-kit-preview-card">
                  <div className="brand-kit-preview-card__eyebrow">Creative voice</div>
                  <div className="brand-kit-preview-card__title">{previewTitle}</div>
                  <p className="brand-kit-preview-card__copy">{draft.description || 'Build a reusable look and feel for paid social, display, and rich media.'}</p>
                  <div className="brand-kit-preview-chip-row">
                    <span className="pill pill-highlight">Accent {previewAccent}</span>
                    <span className="pill">Text {previewText}</span>
                    <span className="pill">BG {previewBackground}</span>
                  </div>
                </article>
                <article className="brand-kit-preview-card brand-kit-preview-card--type">
                  <div className="brand-kit-preview-card__eyebrow">Typography</div>
                  <div className="brand-kit-preview-type-sample">
                    <strong>{previewHeadingFont}</strong>
                    <span>{previewBodyFont}</span>
                  </div>
                  <div className="brand-kit-preview-copy-block">
                    <span>Own the first frame.</span>
                    <small>Readable, bold, and campaign-ready.</small>
                  </div>
                </article>
                <article className="brand-kit-preview-card brand-kit-preview-card--cta">
                  <div className="brand-kit-preview-card__eyebrow">Surface + CTA</div>
                  <div className="brand-kit-preview-shell">
                    <div className="brand-kit-preview-shell__surface">
                      <span>Radius {previewRadius ? `${previewRadius}px` : 'Set medium radius'}</span>
                      <button type="button" className="brand-kit-preview-button">Launch creative</button>
                    </div>
                  </div>
                </article>
              </section>

              <div className="fields-grid">
                <div>
                  <label>Name</label>
                  <input value={draft.name ?? ''} onChange={(event) => controller.updateDraft({ name: event.target.value })} placeholder="Summer Editorial Kit" />
                </div>
                <div>
                  <label>Brand name</label>
                  <input value={draft.brandName ?? ''} onChange={(event) => controller.updateDraft({ brandName: event.target.value })} placeholder="Bocadeli" />
                </div>
                <div>
                  <label>Legacy brand id</label>
                  <input value={draft.brandId ?? ''} onChange={(event) => controller.updateDraft({ brandId: event.target.value })} placeholder="brand_123" />
                </div>
                <div>
                  <label>Description</label>
                  <input value={draft.description ?? ''} onChange={(event) => controller.updateDraft({ description: event.target.value })} placeholder="Seasonal paid social + display palette" />
                </div>
              </div>

              <section className="brand-kit-editor-section">
                <h4>Colors</h4>
                <div className="brand-kit-editor-grid">
                  <ColorControl label="Background" value={draft.colors?.background ?? ''} fallback="#fff8e8" onChange={(value) => controller.updateDraftColors({ background: value })} />
                  <ColorControl label="Surface" value={draft.colors?.surface ?? ''} fallback="#ffffff" onChange={(value) => controller.updateDraftColors({ surface: value })} />
                  <ColorControl label="Text" value={draft.colors?.text ?? ''} fallback="#102030" onChange={(value) => controller.updateDraftColors({ text: value })} />
                  <ColorControl label="Accent" value={draft.colors?.accent ?? ''} fallback="#ff7a18" onChange={(value) => controller.updateDraftColors({ accent: value })} />
                </div>
              </section>

              <section className="brand-kit-editor-section">
                <h4>Typography</h4>
                <div className="fields-grid">
                  <div>
                    <label>Font family</label>
                    <input value={draft.typography?.fontFamily ?? ''} onChange={(event) => controller.updateDraftTypography({ fontFamily: event.target.value })} placeholder="Avenir Next" />
                  </div>
                  <div>
                    <label>Heading family</label>
                    <input value={draft.typography?.headingFamily ?? ''} onChange={(event) => controller.updateDraftTypography({ headingFamily: event.target.value })} placeholder="Avenir Next Condensed" />
                  </div>
                  <div>
                    <label>Body family</label>
                    <input value={draft.typography?.bodyFamily ?? ''} onChange={(event) => controller.updateDraftTypography({ bodyFamily: event.target.value })} placeholder="Avenir Next" />
                  </div>
                </div>
              </section>

              <section className="brand-kit-editor-section">
                <h4>Radii</h4>
                <div className="fields-grid">
                  <div>
                    <label>Small</label>
                    <input
                      type="number"
                      value={numberInputValue(draft.radii?.sm)}
                      onChange={(event) => controller.updateDraftRadii({ sm: event.target.value ? Number(event.target.value) : undefined })}
                      placeholder="8"
                    />
                  </div>
                  <div>
                    <label>Medium</label>
                    <input
                      type="number"
                      value={numberInputValue(draft.radii?.md)}
                      onChange={(event) => controller.updateDraftRadii({ md: event.target.value ? Number(event.target.value) : undefined })}
                      placeholder="16"
                    />
                  </div>
                  <div>
                    <label>Large</label>
                    <input
                      type="number"
                      value={numberInputValue(draft.radii?.lg)}
                      onChange={(event) => controller.updateDraftRadii({ lg: event.target.value ? Number(event.target.value) : undefined })}
                      placeholder="24"
                    />
                  </div>
                </div>
              </section>

              <section className="brand-kit-editor-section">
                <h4>Motion</h4>
                <div className="fields-grid">
                  <div>
                    <label>Duration (ms)</label>
                    <input
                      type="number"
                      value={numberInputValue(draft.motion?.durationMs)}
                      onChange={(event) => controller.updateDraftMotion({ durationMs: event.target.value ? Number(event.target.value) : undefined })}
                      placeholder="320"
                    />
                  </div>
                  <div>
                    <label>Easing</label>
                    <input
                      value={draft.motion?.easing ?? ''}
                      onChange={(event) => controller.updateDraftMotion({ easing: event.target.value })}
                      placeholder="cubic-bezier(0.2, 0.8, 0.2, 1)"
                    />
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>

        <div className="brand-kit-drawer-footer">
          <div className="brand-kit-drawer-apply">
            <span className="brand-kit-drawer-footer-label">Apply to current document</span>
            <Button variant="ghost" size="sm" onClick={() => controller.applySelectedBrandKit('merge')} disabled={!selectedBrandKit}>
              Apply merge
            </Button>
            <Button variant="primary" size="sm" onClick={() => controller.applySelectedBrandKit('replace')} disabled={!selectedBrandKit}>
              Apply replace
            </Button>
          </div>
          <div className="brand-kit-drawer-commit">
            <span className="brand-kit-drawer-footer-label">Save to workspace</span>
            <Button variant="ghost" size="sm" onClick={() => void controller.removeSelectedBrandKit()} disabled={!selectedBrandKit || !controller.canManageBrandkits || controller.deleting}>
              {controller.deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button variant="primary" size="sm" onClick={() => void controller.persistDraft()} disabled={!controller.canManageBrandkits || controller.saving}>
              {controller.saving ? 'Saving…' : selectedBrandKit ? 'Update kit' : 'Save kit'}
            </Button>
          </div>
        </div>
      </div>
  );

  if (embedded) {
    return <div className="brand-kit-drawer-embedded-shell">{drawer}</div>;
  }

  return (
    <div className="brand-kit-drawer-shell" role="dialog" aria-modal="true" aria-labelledby="brand-kit-drawer-title" onClick={onClose}>
      {drawer}
    </div>
  );
}
