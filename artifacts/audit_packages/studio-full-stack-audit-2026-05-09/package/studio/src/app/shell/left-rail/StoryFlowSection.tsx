import { Suspense, lazy, useEffect, useState } from 'react';
import type { LeftRailController } from './use-left-rail-controller';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { SurfaceButton } from '../../../shared/ui/SurfaceButton';
import {
  readStoryFlowViewPreference,
  writeStoryFlowViewPreference,
  type StoryFlowViewMode,
} from './story-flow-preferences';

const StoryFlowCanvas = lazy(async () => import('./StoryFlowCanvas').then((module) => ({ default: module.StoryFlowCanvas })));

export function StoryFlowSection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { scenes, activeSceneId, sceneActions } = controller;
  const [viewMode, setViewMode] = useState<StoryFlowViewMode>(() => readStoryFlowViewPreference('list'));

  useEffect(() => {
    writeStoryFlowViewPreference(viewMode);
  }, [viewMode]);

  return (
    <>
      <div className="left-rail-section-head section-offset-top">
        <div>
          <div className="left-title">Story flow</div>
          <strong className="rail-heading">Scenes</strong>
        </div>
        <div className="layer-actions">
          <IconButton label="Add scene" icon={<StudioIcon icon={StudioIcons.plus} size={16} />} onClick={() => sceneActions.addScene()} />
          <IconButton label="Duplicate scene" icon={<StudioIcon icon={StudioIcons.copy} size={16} />} onClick={() => sceneActions.duplicateScene(activeSceneId)} />
          <IconButton label="Delete scene" variant="danger" icon={<StudioIcon icon={StudioIcons.trash} size={16} />} onClick={() => sceneActions.deleteScene(activeSceneId)} disabled={scenes.length <= 1} />
        </div>
      </div>
      <div className="field-stack section-offset-bottom">
        <SegmentedControl
          options={[
            { id: 'list', label: 'List' },
            { id: 'canvas', label: 'Canvas' },
          ]}
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="Story flow view"
        />
        {viewMode === 'canvas' ? (
          <Suspense fallback={<div className="story-flow-canvas-loading">Loading flow canvas…</div>}>
            <StoryFlowCanvas controller={controller} />
          </Suspense>
        ) : (
          <div className="field-stack">
            {scenes.map((item, index) => {
              const nextName = scenes.find((sceneItem) => sceneItem.id === item.flow?.nextSceneId)?.name ?? 'Auto / End';
              const branches = item.flow?.branches ?? (item.flow?.branchEquals ? [item.flow.branchEquals] : []);
              const active = item.id === activeSceneId;
              return (
                <SurfaceButton key={item.id} layout="stack" isActive={active} className={`left-button ${active ? 'is-active' : ''}`} onClick={() => sceneActions.selectScene(item.id)}>
                  <div className="meta-line">
                    <strong>{index + 1}. {item.name}</strong>
                    <span className="pill">{item.durationMs}ms</span>
                  </div>
                  <small className="muted">Next: {nextName}</small>
                  {branches.length ? <div className="story-flow-branch-list">{branches.slice(0, 3).map((branch, branchIndex) => <small className="muted story-flow-branch-item" key={`${item.id}-${branchIndex}`}><StudioIcon icon={StudioIcons.cornerDownRight} size={12} /> {branch.label || `${branch.field} ${(branch.operator ?? 'equals')} ${branch.value}`} to {scenes.find((sceneItem) => sceneItem.id === branch.targetSceneId)?.name ?? 'Unknown'}</small>)}{branches.length > 3 ? <small className="muted">+{branches.length - 3} more branches</small> : null}</div> : null}
                </SurfaceButton>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
