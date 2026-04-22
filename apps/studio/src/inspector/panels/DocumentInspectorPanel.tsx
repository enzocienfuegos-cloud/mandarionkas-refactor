import { useStudioStore } from '../../core/store/use-studio-store';
import { CanvasSection } from '../sections/document/CanvasSection';
import { ScenesSection } from '../sections/document/ScenesSection';
import { RuntimeSection } from '../sections/document/RuntimeSection';
import { FeedCatalogSection } from '../sections/document/FeedCatalogSection';
import { RemoteJsonImportSection } from '../sections/document/RemoteJsonImportSection';
import { DiagnosticsSection } from '../sections/document/DiagnosticsSection';
import { VideoAnalyticsSection } from '../sections/document/VideoAnalyticsSection';
import { CommentsSection } from '../sections/document/CommentsSection';
import { ApprovalsSection } from '../sections/document/ApprovalsSection';
import { ShareHandoffSection } from '../sections/document/ShareHandoffSection';
import { useDocumentInspectorTab } from '../sections/document/document-inspector-shared';
import { channelSupportsFeedCatalog } from '../sections/document/channel-capabilities';

export function DocumentInspectorPanel(): JSX.Element {
  const [tab, setTab] = useDocumentInspectorTab('overview');
  const targetChannel = useStudioStore((state) => state.document.metadata.release.targetChannel);
  const showFeedCatalog = channelSupportsFeedCatalog(targetChannel);

  return (
    <>
      <div className="inspector-tabs">
        <button className={tab === 'overview' ? 'primary' : 'ghost'} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'data' ? 'primary' : 'ghost'} onClick={() => setTab('data')}>Data</button>
        <button className={tab === 'collab' ? 'primary' : 'ghost'} onClick={() => setTab('collab')}>Collab</button>
      </div>

      {tab === 'overview' ? (
        <>
          <details className="inspector-accordion" open>
            <summary>
              <span>Scenes</span>
              <small>Scene list and navigation</small>
            </summary>
            <div className="inspector-accordion-body">
              <ScenesSection />
            </div>
          </details>
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
          {showFeedCatalog ? (
            <details className="inspector-accordion" open>
              <summary>
                <span>Feed catalog</span>
                <small>Dynamic data sources and records</small>
              </summary>
              <div className="inspector-accordion-body">
                <section className="section section-premium">
                  <FeedCatalogSection />
                </section>
              </div>
            </details>
          ) : (
            <div className="inspector-empty-state">
              <small className="muted">
                Feed catalog is not available for <strong>{targetChannel}</strong>. Switch to IAB HTML5, Google Display or GAM HTML5 to use dynamic data.
              </small>
            </div>
          )}
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
              <section className="section section-premium">
                <h3>Video analytics</h3>
                <VideoAnalyticsSection />
              </section>
            </div>
          </details>
        </>
      ) : null}

      {tab === 'collab' ? (
        <>
          <details className="inspector-accordion" open>
            <summary>
              <span>Comments</span>
              <small>Feedback threads on this document</small>
            </summary>
            <div className="inspector-accordion-body">
              <section className="section section-premium">
                <CommentsSection />
              </section>
            </div>
          </details>
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
