import { useCallback, useState } from 'react';
import { AssetLibraryModal } from './AssetLibraryModal';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { Workspace } from './Workspace';
import { RightInspector } from '../../inspector/RightInspector';
import { BottomTimeline } from '../../timeline/BottomTimeline';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const LEFT_RAIL_DEFAULT_WIDTH = 288;
const LEFT_RAIL_MIN_WIDTH = 200;
const LEFT_RAIL_MAX_WIDTH = 520;

type StudioShellProps = {
  onOpenWorkspaceHub(): void;
};

export function StudioShell({ onOpenWorkspaceHub }: StudioShellProps): JSX.Element {
  const [leftRailWidth, setLeftRailWidth] = useState(LEFT_RAIL_DEFAULT_WIDTH);
  const [leftRailHidden, setLeftRailHidden] = useState(false);
  const [rightInspectorHidden, setRightInspectorHidden] = useState(false);
  const [timelineHidden, setTimelineHidden] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);

  const handleLeftRailResizeStart = useCallback((startX: number) => {
    const startWidth = leftRailWidth;
    const onMove = (event: PointerEvent) =>
      setLeftRailWidth(clamp(startWidth + (event.clientX - startX), LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [leftRailWidth]);

  const handleTimelineResizeStart = useCallback((startY: number) => {
    const startHeight = timelineHeight;
    const onMove = (event: PointerEvent) => setTimelineHeight(clamp(startHeight - (event.clientY - startY), 160, 520));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [timelineHeight]);

  return (
    <div
      className="studio-shell"
      style={{
        gridTemplateColumns: `${leftRailHidden ? '0px' : `${leftRailWidth}px`} minmax(0, 1fr) ${rightInspectorHidden ? '0px' : '328px'}`,
        gridTemplateRows: `64px minmax(0, 1fr) ${timelineHidden ? '0px' : `${timelineHeight}px`}`,
      }}
    >
      <TopBar onOpenWorkspaceHub={onOpenWorkspaceHub} onOpenAssets={() => setAssetLibraryOpen(true)} />
      {!leftRailHidden ? <LeftRail onToggleCollapse={() => setLeftRailHidden(true)} onResizeStart={handleLeftRailResizeStart} /> : null}
      <Workspace onOpenAssetLibrary={() => setAssetLibraryOpen(true)} />
      {!rightInspectorHidden ? <RightInspector onToggleCollapse={() => setRightInspectorHidden(true)} /> : null}
      {!timelineHidden ? (
        <BottomTimeline
          onResizeStart={handleTimelineResizeStart}
          onToggleCollapse={() => setTimelineHidden(true)}
        />
      ) : null}

      {leftRailHidden ? (
        <button className="collapsed-panel-tab collapsed-panel-tab-left" type="button" onClick={() => setLeftRailHidden(false)}>
          <span>▦</span>
          <span>Panels</span>
        </button>
      ) : null}

      {rightInspectorHidden ? (
        <button className="collapsed-panel-tab collapsed-panel-tab-right" type="button" onClick={() => setRightInspectorHidden(false)}>
          <span>Inspector</span>
          <span>‹</span>
        </button>
      ) : null}

      {timelineHidden ? (
        <button className="collapsed-panel-tab collapsed-panel-tab-bottom" type="button" onClick={() => setTimelineHidden(false)}>
          <span>⌃</span>
          <span>Timeline</span>
        </button>
      ) : null}
      {assetLibraryOpen ? <AssetLibraryModal onClose={() => setAssetLibraryOpen(false)} /> : null}
    </div>
  );
}
