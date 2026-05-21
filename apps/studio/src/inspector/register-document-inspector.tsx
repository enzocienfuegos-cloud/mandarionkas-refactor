import { ApprovalsSection } from './sections/document/ApprovalsSection';
import { BrandKitSection } from './sections/document/BrandKitSection';
import { CanvasSection } from './sections/document/CanvasSection';
import { EndCardTriggerSection } from './sections/document/EndCardTriggerSection';
import { CommentsSection } from './sections/document/CommentsSection';
import { DiagnosticsSection } from './sections/document/DiagnosticsSection';
import { FeedCatalogSection } from './sections/document/FeedCatalogSection';
import { RemoteJsonImportSection } from './sections/document/RemoteJsonImportSection';
import { RuntimeSection } from './sections/document/RuntimeSection';
import { ScenesSection } from './sections/document/ScenesSection';
import { ShareHandoffSection } from './sections/document/ShareHandoffSection';
import { VariantRulesSection } from './sections/document/VariantRulesSection';
import { VideoAnalyticsSection } from './sections/document/VideoAnalyticsSection';
import { channelSupportsFeedCatalog } from './sections/document/channel-capabilities';
import {
  registerDocumentInspectorPanel,
  registerDocumentInspectorTab,
} from './document-inspector-registry';

function CanvasRuntimePanel(): JSX.Element {
  return (
    <>
      <CanvasSection />
      <EndCardTriggerSection />
      <RuntimeSection />
    </>
  );
}

function ImportsDiagnosticsPanel(): JSX.Element {
  return (
    <>
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
    </>
  );
}

function CommentsPanel(): JSX.Element {
  return (
    <section className="section section-premium">
      <CommentsSection />
    </section>
  );
}

function ApprovalsHandoffPanel(): JSX.Element {
  return (
    <>
      <section className="section section-premium">
        <h3>Approvals</h3>
        <ApprovalsSection />
      </section>
      <section className="section section-premium">
        <h3>Share & handoff</h3>
        <ShareHandoffSection />
      </section>
    </>
  );
}

export function registerDocumentInspectorBuiltins(): void {
  registerDocumentInspectorPanel({
    key: 'scenes',
    title: 'Scenes',
    subtitle: 'Scene list and navigation',
    defaultOpen: true,
    Component: ScenesSection,
  });
  registerDocumentInspectorPanel({
    key: 'canvas-runtime',
    title: 'Canvas & runtime',
    subtitle: 'Stage size, background and playback defaults',
    Component: CanvasRuntimePanel,
  });
  registerDocumentInspectorPanel({
    key: 'brand-kit',
    title: 'Brand kit',
    subtitle: 'Apply or review reusable creative styling kits',
    defaultOpen: true,
    Component: BrandKitSection,
  });
  registerDocumentInspectorPanel({
    key: 'feed-catalog',
    title: 'Feed catalog',
    subtitle: 'Dynamic data sources and records',
    defaultOpen: true,
    visible: (state) => channelSupportsFeedCatalog(state.document.metadata.release.targetChannel),
    Component: FeedCatalogSection,
  });
  registerDocumentInspectorPanel({
    key: 'variant-rules',
    title: 'Variants',
    subtitle: 'Audience and locale rules for DCO previews',
    defaultOpen: true,
    Component: VariantRulesSection,
  });
  registerDocumentInspectorPanel({
    key: 'imports-diagnostics',
    title: 'Imports & diagnostics',
    subtitle: 'Remote JSON, parsing and readiness review',
    Component: ImportsDiagnosticsPanel,
  });
  registerDocumentInspectorPanel({
    key: 'comments',
    title: 'Comments',
    subtitle: 'Feedback threads on this document',
    defaultOpen: true,
    Component: CommentsPanel,
  });
  registerDocumentInspectorPanel({
    key: 'approvals-handoff',
    title: 'Approvals & handoff',
    subtitle: 'Review state, sign-off and share links',
    Component: ApprovalsHandoffPanel,
  });

  registerDocumentInspectorTab({ id: 'overview', label: 'Overview', panels: ['scenes', 'canvas-runtime'] });
  registerDocumentInspectorTab({ id: 'data', label: 'Data', panels: ['brand-kit', 'variant-rules', 'feed-catalog', 'imports-diagnostics'] });
  registerDocumentInspectorTab({ id: 'collab', label: 'Collab', panels: ['comments', 'approvals-handoff'] });
}
