import { useDocumentInspectorContext } from './document-inspector-shared';
import { Button } from '../../../shared/ui/Button';
import { useBrandKitController } from '../../../app/shell/topbar/use-brand-kit-controller';

export function BrandKitSection(): JSX.Element {
  const { document } = useDocumentInspectorContext();
  const controller = useBrandKitController();

  return (
    <section className="section section-premium">
      <h3>Brand kit</h3>
      <div className="field-stack">
        <div className="meta-line">
          <span className="pill">{controller.brandKits.length} available</span>
          {document.metadata.platform?.brandKitName ? <span className="pill pill-highlight">Applied {document.metadata.platform.brandKitName}</span> : <span className="pill">No Brand Kit applied</span>}
        </div>
        <div className="fields-grid">
          <div>
            <label>Choose Brand Kit</label>
            <select value={controller.selectedBrandKitId} onChange={(event) => controller.setSelectedBrandKitId(event.target.value)}>
              <option value="">Select a Brand Kit…</option>
              {controller.brandKits.map((brandKit) => <option key={brandKit.id} value={brandKit.id}>{brandKit.name}</option>)}
            </select>
          </div>
          <div>
            <label>Current mapping</label>
            <input
              readOnly
              value={document.metadata.platform?.brandKitName ?? document.metadata.platform?.brandName ?? 'None'}
              aria-label="Current applied brand kit"
            />
          </div>
        </div>
        {controller.selectedBrandKit ? (
          <div className="meta-line">
            <span className="pill">Brand {controller.selectedBrandKit.brandName ?? 'Unassigned'}</span>
            {controller.selectedBrandKit.colors?.background ? <span className="pill">BG {controller.selectedBrandKit.colors.background}</span> : null}
            {controller.selectedBrandKit.colors?.accent ? <span className="pill">Accent {controller.selectedBrandKit.colors.accent}</span> : null}
            {controller.selectedBrandKit.typography?.fontFamily ? <span className="pill">Font {controller.selectedBrandKit.typography.fontFamily}</span> : null}
          </div>
        ) : null}
        <div className="brand-kit-inline-actions">
          <Button variant="ghost" size="sm" onClick={() => void controller.refresh()} disabled={controller.loading}>
            {controller.loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => controller.applySelectedBrandKit('merge')} disabled={!controller.selectedBrandKit}>
            Apply merge
          </Button>
          <Button variant="primary" size="sm" onClick={() => controller.applySelectedBrandKit('replace')} disabled={!controller.selectedBrandKit}>
            Apply replace
          </Button>
        </div>
        <small className="muted">Replace overwrites mapped style slots. Merge only fills missing values on the current document.</small>
      </div>
    </section>
  );
}
