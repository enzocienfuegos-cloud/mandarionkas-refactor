import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { createInspectorField, createInspectorSection } from '../../contract-driven';
import { useDocumentInspectorContext } from './document-inspector-shared';

export function ProjectContextSection(): JSX.Element {
  const { document, activeClient, currentUser } = useDocumentInspectorContext();
  const { updatePlatformMetadata } = useDocumentActions();

  return createInspectorSection({
    title: 'Project context',
    meta: (
      <div className="meta-line">
        <span className="pill">User {currentUser?.name ?? 'Anonymous'}{currentUser ? ` · ${currentUser.role}` : ''}</span>
        <span className="pill">Client {activeClient?.name ?? 'None'}</span>
        <span className="pill">Brands {activeClient?.brands?.length ?? 0}</span>
      </div>
    ),
    children: (
      <>
        <div className="fields-grid">
          {createInspectorField({
            kind: 'select',
            label: 'Brand kit',
            value: document.metadata.platform?.brandId ?? '',
            onChange: (value) => {
              const brand = activeClient?.brands?.find((item) => item.id === value);
              updatePlatformMetadata({ brandId: brand?.id, brandName: brand?.name ?? '', clientId: activeClient?.id, clientName: activeClient?.name });
            },
            options: [
              { label: 'No brand kit', value: '' },
              ...(activeClient?.brands ?? []).map((brand) => ({ label: brand.name, value: brand.id })),
            ],
          })}
          {createInspectorField({
            kind: 'text',
            label: 'Campaign',
            value: document.metadata.platform?.campaignName ?? '',
            placeholder: 'Q4 Launch',
            onChange: (value) => updatePlatformMetadata({ campaignName: value, clientId: activeClient?.id, clientName: activeClient?.name }),
          })}
          {createInspectorField({
            kind: 'select',
            label: 'Access scope',
            value: document.metadata.platform?.accessScope ?? 'client',
            onChange: (value) => updatePlatformMetadata({ accessScope: value as 'private' | 'client' | 'reviewers', clientId: activeClient?.id, clientName: activeClient?.name }),
            options: [
              { label: 'Client shared', value: 'client' },
              { label: 'Private', value: 'private' },
              { label: 'Reviewers only', value: 'reviewers' },
            ],
          })}
        </div>
        <div className="meta-line">
          {document.metadata.platform?.brandName ? <span className="pill">Selected brand {document.metadata.platform.brandName}</span> : null}
          <span className="pill">Project scope {document.metadata.platform?.accessScope ?? 'client'}</span>
        </div>
        <small className="muted">Platform metadata stays minimal inside the document. Ownership and sharing rules remain in the workspace layer.</small>
      </>
    ),
  });
}
