import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import type { TopBarController } from './use-top-bar-controller';

export function TopBarDocumentControls({ controller, compact = false }: { controller: TopBarController; compact?: boolean }): JSX.Element {
  const { activeSceneId, scenes, canvasPresetId, activeVariant, activeFeedSource, activeFeedRecordId } = controller.snapshot;
  const { sceneActions, documentActions, uiActions, sources, records } = controller.document;

  return (
    <div className={`top-control-group ${compact ? 'top-control-group--compact' : ''}`}>
      <strong className="section-kicker">Document</strong>
      <div className="top-control-grid">
        <button className="ghost" onClick={() => sceneActions.previousScene()}>← Scene</button>
        <select value={activeSceneId} onChange={(event) => sceneActions.selectScene(event.target.value)}>
          {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
        </select>
        <button className="ghost" onClick={() => sceneActions.nextScene()}>Scene →</button>
        <select value={canvasPresetId} onChange={(event) => documentActions.applyCanvasPreset(event.target.value)}>
          {CANVAS_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
        <select value={activeVariant} onChange={(event) => uiActions.setActiveVariant(event.target.value as 'default' | 'promo' | 'alternate')}>
          <option value="default">Default</option>
          <option value="promo">Promo</option>
          <option value="alternate">Alternate</option>
        </select>
        <select value={activeFeedSource} onChange={(event) => uiActions.setActiveFeedSource(event.target.value as typeof activeFeedSource)}>
          {sources.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={activeFeedRecordId} onChange={(event) => uiActions.setActiveFeedRecord(event.target.value)}>
          {records.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
    </div>
  );
}
