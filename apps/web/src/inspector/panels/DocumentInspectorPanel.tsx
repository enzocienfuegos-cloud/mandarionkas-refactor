import { usePlatformPermission } from '../../platform/runtime';
import { ProjectContextSection } from '../sections/document/ProjectContextSection';
import { StoryInfoSection } from '../sections/document/StoryInfoSection';
import { CanvasSection } from '../sections/document/CanvasSection';
import { ScenesSection } from '../sections/document/ScenesSection';
import { RuntimeSection } from '../sections/document/RuntimeSection';
import { FeedCatalogSection } from '../sections/document/FeedCatalogSection';
import { RemoteJsonImportSection } from '../sections/document/RemoteJsonImportSection';
import { DiagnosticsSection } from '../sections/document/DiagnosticsSection';
import { ReleaseSettingsSection } from '../sections/document/ReleaseSettingsSection';
import { ExportSection } from '../sections/document/ExportSection';
import { CommentsSection } from '../sections/document/CommentsSection';
import { ApprovalsSection } from '../sections/document/ApprovalsSection';
import { ShareHandoffSection } from '../sections/document/ShareHandoffSection';
import { useDocumentInspectorTab } from '../sections/document/document-inspector-shared';

export function DocumentInspectorPanel(): JSX.Element {
  const [tab, setTab] = useDocumentInspectorTab('overview');
  const canManageRelease = usePlatformPermission('release:manage');

  return (
    <>
      <div className="inspector-tabs">
        <button className={tab === 'overview' ? 'primary' : 'ghost'} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'data' ? 'primary' : 'ghost'} onClick={() => setTab('data')}>Data</button>
        <button className={tab === 'release' ? 'primary' : 'ghost'} onClick={() => setTab('release')}>Release</button>
        <button className={tab === 'collab' ? 'primary' : 'ghost'} onClick={() => setTab('collab')}>Collab</button>
      </div>

      {tab === 'overview' ? (
        <>
          <ProjectContextSection />
          <StoryInfoSection />
          <ScenesSection />
          <details className="inspector-accordion">
            <summary>
              <span>Canvas & runtime</span>
              <small>Stage size, background and playback defaults</small>
            </summary>
            <div className="inspector-accordion-body">
              <CanvasSection />
              <RuntimeSection />
            </div>
          </details>
        </>
      ) : null}

      {tab === 'data' ? (
        <>
          <section className="section section-premium">
            <h3>Feed catalog</h3>
            <FeedCatalogSection />
          </section>
          <details className="inspector-accordion">
            <summary>
              <span>Imports & diagnostics</span>
              <small>Remote JSON, parsing and readiness review</small>
            </summary>
            <div className="inspector-accordion-body">
              <section className="section section-premium">
                <h3>Remote JSON import</h3>
                <RemoteJsonImportSection />
              </section>
              <section className="section section-premium">
                <h3>Diagnostics</h3>
                <DiagnosticsSection />
              </section>
            </div>
          </details>
        </>
      ) : null}

      {tab === 'release' ? (
        <>
          <section className="section section-premium">
            <h3>Export</h3>
            <ExportSection />
          </section>
          <details className="inspector-accordion">
            <summary>
              <span>Release settings</span>
              <small>Permissions, release channel and approvals</small>
            </summary>
            <div className="inspector-accordion-body">
              <section className="section section-premium">
                <h3>Release settings</h3>
                {canManageRelease ? <ReleaseSettingsSection /> : <small className="muted">Your current role cannot change release settings.</small>}
              </section>
            </div>
          </details>
        </>
      ) : null}

      {tab === 'collab' ? (
        <>
          <section className="section section-premium">
            <h3>Comments</h3>
            <CommentsSection />
          </section>
          <details className="inspector-accordion">
            <summary>
              <span>Approvals & handoff</span>
              <small>Review state, sign-off and share links</small>
            </summary>
            <div className="inspector-accordion-body">
              <section className="section section-premium">
                <h3>Approvals</h3>
                <ApprovalsSection />
              </section>
              <section className="section section-premium">
                <h3>Share & handoff</h3>
                <ShareHandoffSection />
              </section>
            </div>
          </details>
        </>
      ) : null}
    </>
  );
}
