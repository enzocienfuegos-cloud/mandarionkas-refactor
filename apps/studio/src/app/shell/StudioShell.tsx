import { useCallback, useState, type CSSProperties } from 'react';
import { AssetLibraryModal } from './AssetLibraryModal';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { Workspace } from './Workspace';
import { RightInspector } from '../../inspector/RightInspector';
import { BottomTimeline } from '../../timeline/BottomTimeline';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import {
  LEFT_RAIL_MAX_WIDTH,
  LEFT_RAIL_MIN_WIDTH,
  RIGHT_INSPECTOR_MAX_WIDTH,
  RIGHT_INSPECTOR_MIN_WIDTH,
  TIMELINE_MAX_HEIGHT,
  TIMELINE_MIN_HEIGHT,
  useShellLayout,
} from './use-shell-layout';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type StudioShellProps = {
  onOpenWorkspaceHub(): void;
};

export function StudioShell({ onOpenWorkspaceHub }: StudioShellProps): JSX.Element {
  const [layout, setLayout] = useShellLayout();
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const {
    leftRailWidth,
    rightInspectorWidth,
    timelineHeight,
    leftRailHidden,
    rightInspectorHidden,
    timelineHidden,
  } = layout;

  const handleLeftRailResizeStart = useCallback((startX: number, edge: 'left' | 'right') => {
    const startWidth = leftRailWidth;
    const onMove = (event: PointerEvent) => {
      const delta = event.clientX - startX;
      const nextWidth = edge === 'right'
        ? startWidth + delta
        : startWidth - delta;
      setLayout((current) => ({
        ...current,
        leftRailWidth: clamp(nextWidth, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [leftRailWidth, setLayout]);

  const handleRightInspectorResizeStart = useCallback((startX: number) => {
    const startWidth = rightInspectorWidth;
    const onMove = (event: PointerEvent) => {
      const nextWidth = startWidth + (startX - event.clientX);
      setLayout((current) => ({
        ...current,
        rightInspectorWidth: clamp(nextWidth, RIGHT_INSPECTOR_MIN_WIDTH, RIGHT_INSPECTOR_MAX_WIDTH),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [rightInspectorWidth, setLayout]);

  const handleTimelineResizeStart = useCallback((startY: number) => {
    const startHeight = timelineHeight;
    const onMove = (event: PointerEvent) => {
      setLayout((current) => ({
        ...current,
        timelineHeight: clamp(startHeight - (event.clientY - startY), TIMELINE_MIN_HEIGHT, TIMELINE_MAX_HEIGHT),
      }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [timelineHeight, setLayout]);

  const shellStyle = {
    '--shell-left-w': leftRailHidden ? '0px' : `${leftRailWidth}px`,
    '--shell-right-w': rightInspectorHidden ? '0px' : `${rightInspectorWidth}px`,
    '--shell-bottom-h': timelineHidden ? '0px' : `${timelineHeight}px`,
  } as CSSProperties;

  return (
    <div
      className={`studio-shell ${leftRailHidden ? 'is-left-collapsed' : ''} ${rightInspectorHidden ? 'is-right-collapsed' : ''} ${timelineHidden ? 'is-bottom-collapsed' : ''}`.trim()}
      style={shellStyle}
    >
      <TopBar onOpenWorkspaceHub={onOpenWorkspaceHub} onOpenAssets={() => setAssetLibraryOpen(true)} />
      {!leftRailHidden ? (
        <LeftRail
          onToggleCollapse={() => setLayout((current) => ({ ...current, leftRailHidden: true }))}
          onResizeStart={handleLeftRailResizeStart}
        />
      ) : null}
      <Workspace onOpenAssetLibrary={() => setAssetLibraryOpen(true)} />
      {!rightInspectorHidden ? (
        <RightInspector
          onToggleCollapse={() => setLayout((current) => ({ ...current, rightInspectorHidden: true }))}
          onResizeStart={handleRightInspectorResizeStart}
        />
      ) : null}
      {!timelineHidden ? (
        <BottomTimeline
          onResizeStart={handleTimelineResizeStart}
          onToggleCollapse={() => setLayout((current) => ({ ...current, timelineHidden: true }))}
        />
      ) : null}

      {leftRailHidden ? (
        <button
          className="collapsed-panel-tab collapsed-panel-tab-left"
          type="button"
          onClick={() => setLayout((current) => ({ ...current, leftRailHidden: false }))}
        >
          <StudioIcon icon={StudioIcons.panelLeftOpen} size={18} />
          <span>Panels</span>
        </button>
      ) : null}

      {rightInspectorHidden ? (
        <button
          className="collapsed-panel-tab collapsed-panel-tab-right"
          type="button"
          onClick={() => setLayout((current) => ({ ...current, rightInspectorHidden: false }))}
        >
          <span>Inspector</span>
          <StudioIcon icon={StudioIcons.panelRightOpen} size={18} />
        </button>
      ) : null}

      {timelineHidden ? (
        <button
          className="collapsed-panel-tab collapsed-panel-tab-bottom"
          type="button"
          onClick={() => setLayout((current) => ({ ...current, timelineHidden: false }))}
        >
          <StudioIcon icon={StudioIcons.panelBottomOpen} size={18} />
          <span>Timeline</span>
        </button>
      ) : null}
      {assetLibraryOpen ? <AssetLibraryModal onClose={() => setAssetLibraryOpen(false)} /> : null}
    </div>
  );
}
