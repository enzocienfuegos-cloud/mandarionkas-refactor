import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';

export function ProjectContextSection(): JSX.Element {
  const { document, activeClient, currentUser } = useDocumentInspectorContext();
  const { updatePlatformMetadata } = useDocumentActions();

  return (
    <section className="section section-premium">
      <h3>Project context</h3>
      <div className="field-stack">
        <div className="meta-line">
          <span className="pill">User {currentUser?.name ?? 'Anonymous'}{currentUser ? ` · ${currentUser.role}` : ''}</span>
          <span className="pill">Client {activeClient?.name ?? 'None'}</span>
          <span className="pill">Brands {activeClient?.brands?.length ?? 0}</span>
        </div>
        <div className="fields-grid">
          <div>
            <label>Brand kit</label>
            <select
              value={document.metadata.platform?.brandId ?? ''}
              onChange={(event) => {
                const brand = activeClient?.brands?.find((item) => item.id === event.target.value);
                updatePlatformMetadata({ brandId: brand?.id, brandName: brand?.name ?? '', clientId: activeClient?.id, clientName: activeClient?.name });
              }}
            >
              <option value="">No brand kit</option>
              {(activeClient?.brands ?? []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
            </select>
          </div>
          <div>
            <label>Campaign</label>
            <input
              value={document.metadata.platform?.campaignName ?? ''}
              onChange={(event) => updatePlatformMetadata({ campaignName: event.target.value, clientId: activeClient?.id, clientName: activeClient?.name })}
              placeholder="Q4 Launch"
            />
          </div>
          <div>
            <label>Access scope</label>
            <select
              value={document.metadata.platform?.accessScope ?? 'client'}
              onChange={(event) => updatePlatformMetadata({ accessScope: event.target.value as 'private' | 'client' | 'reviewers', clientId: activeClient?.id, clientName: activeClient?.name })}
            >
              <option value="client">Client shared</option>
              <option value="private">Private</option>
              <option value="reviewers">Reviewers only</option>
            </select>
          </div>
        </div>
        <div className="meta-line">
          {document.metadata.platform?.brandName ? <span className="pill">Selected brand {document.metadata.platform.brandName}</span> : null}
          <span className="pill">Project scope {document.metadata.platform?.accessScope ?? 'client'}</span>
        </div>
        <small className="muted">Platform metadata stays minimal inside the document. Ownership and sharing rules remain in the workspace layer.</small>
      </div>
    </section>
  );
}
