import { useState } from 'react';
import { LeftTabBar } from './LeftTabBar';
import { AssetLibrarySection } from './left-rail/AssetLibrarySection';
import { CollaborationSection } from './left-rail/CollaborationSection';
import { LayersSection } from './left-rail/LayersSection';
import { StoryFlowSection } from './left-rail/StoryFlowSection';
import { WidgetLibrarySection } from './left-rail/WidgetLibrarySection';
import { useLeftRailController } from './left-rail/use-left-rail-controller';

export function LeftRail({ onToggleCollapse }: { onToggleCollapse: () => void }): JSX.Element {
  const controller = useLeftRailController();
  const [showMore, setShowMore] = useState(false);

  return (
    <aside className="left-rail left-rail-tabs">
      <LeftTabBar activeTab={controller.activeLeftTab} onSelectTab={controller.setActiveLeftTab} onOpenMore={() => setShowMore((value) => !value)} />
      <div className="left-rail-panel-shell">
        <div className="left-rail-panel-head">
          <div>
            <small className="left-title">Library</small>
            <strong className="rail-heading">
              {controller.activeLeftTab === 'widgets' ? 'Widgets' : null}
              {controller.activeLeftTab === 'layers' ? 'Layers' : null}
              {controller.activeLeftTab === 'assets' ? 'Assets' : null}
              {controller.activeLeftTab === 'flow' ? 'Flow' : null}
            </strong>
          </div>
          <button className="icon-button ghost panel-collapse-button" type="button" title="Hide left panel" aria-label="Hide left panel" onClick={onToggleCollapse}>‹</button>
        </div>
        <div className="left-rail-panel">
          {controller.activeLeftTab === 'widgets' ? <WidgetLibrarySection controller={controller} /> : null}
          {controller.activeLeftTab === 'layers' ? <LayersSection controller={controller} /> : null}
          {controller.activeLeftTab === 'assets' ? <AssetLibrarySection controller={controller} /> : null}
          {controller.activeLeftTab === 'flow' ? <StoryFlowSection controller={controller} /> : null}
        </div>
      </div>
      {showMore ? (
        <div className="left-rail-more panel">
          <CollaborationSection controller={controller} />
        </div>
      ) : null}
    </aside>
  );
}
