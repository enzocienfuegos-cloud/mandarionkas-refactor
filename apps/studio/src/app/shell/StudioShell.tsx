import { Suspense, lazy, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { TopBar } from './TopBar';
import { StudioKeyboardShortcuts } from './StudioKeyboardShortcuts';
import { LeftRail } from './LeftRail';
import { Workspace } from './Workspace';
import { RightInspector } from '../../inspector/RightInspector';
import { BottomTimeline } from '../../timeline/BottomTimeline';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { SurfaceButton } from '../../shared/ui/SurfaceButton';
import { PreflightTray } from './PreflightTray';
import {
  LEFT_RAIL_MAX_WIDTH,
  LEFT_RAIL_MIN_WIDTH,
  RIGHT_INSPECTOR_MAX_WIDTH,
  RIGHT_INSPECTOR_MIN_WIDTH,
  TIMELINE_MAX_HEIGHT,
  TIMELINE_MIN_HEIGHT,
  useShellLayout,
} from './use-shell-layout';
import { useShellResize } from './use-shell-resize';
import { registerBuiltins } from '../../widgets/registry/register-builtins';
import { subscribeToOpenAssetLibrary, type AssetLibraryOpenRequest } from '../../shared/asset-library-events';

registerBuiltins();

const AssetLibraryModal = lazy(async () => import('./AssetLibraryModal').then((module) => ({ default: module.AssetLibraryModal })));
const BrandKitDrawer = lazy(async () => import('./topbar/BrandKitDrawer').then((module) => ({ default: module.BrandKitDrawer })));

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type StudioShellProps = {
  onOpenWorkspaceHub(): void;
};

export function StudioShell({ onOpenWorkspaceHub }: StudioShellProps): JSX.Element {
  const [layout, setLayout] = useShellLayout();
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [assetLibraryRequest, setAssetLibraryRequest] = useState<AssetLibraryOpenRequest | undefined>(undefined);
  const [brandKitDrawerOpen, setBrandKitDrawerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const resize = useShellResize();
  const {
    leftRailWidth,
    rightInspectorWidth,
    timelineHeight,
    leftRailHidden,
    rightInspectorHidden,
    timelineHidden,
  } = layout;

  useEffect(() => {
    return subscribeToOpenAssetLibrary((request) => {
      setAssetLibraryRequest(request);
      setAssetLibraryOpen(true);
    });
  }, []);

  const handleLeftRailResizeStart = useCallback((startX: number, edge: 'left' | 'right') => {
    const startWidth = leftRailWidth;
    resize.begin({
      onMove: (event) => {
        const delta = event.clientX - startX;
        const nextWidth = edge === 'right'
          ? startWidth + delta
          : startWidth - delta;
        setLayout((current) => ({
          ...current,
          leftRailWidth: clamp(nextWidth, LEFT_RAIL_MIN_WIDTH, LEFT_RAIL_MAX_WIDTH),
        }));
      },
    });
  }, [leftRailWidth, resize, setLayout]);

  const handleRightInspectorResizeStart = useCallback((startX: number) => {
    const startWidth = rightInspectorWidth;
    resize.begin({
      onMove: (event) => {
        const nextWidth = startWidth + (startX - event.clientX);
        setLayout((current) => ({
          ...current,
          rightInspectorWidth: clamp(nextWidth, RIGHT_INSPECTOR_MIN_WIDTH, RIGHT_INSPECTOR_MAX_WIDTH),
        }));
      },
    });
  }, [resize, rightInspectorWidth, setLayout]);

  const handleTimelineResizeStart = useCallback((startY: number) => {
    const startHeight = timelineHeight;
    resize.begin({
      onMove: (event) => {
        setLayout((current) => ({
          ...current,
          timelineHeight: clamp(startHeight - (event.clientY - startY), TIMELINE_MIN_HEIGHT, TIMELINE_MAX_HEIGHT),
        }));
      },
    });
  }, [resize, setLayout, timelineHeight]);

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
      <TopBar
        onOpenWorkspaceHub={onOpenWorkspaceHub}
        onOpenAssetLibrary={() => {
          setAssetLibraryRequest(undefined);
          setAssetLibraryOpen(true);
        }}
        onOpenBrandKitDrawer={() => setBrandKitDrawerOpen(true)}
      />
      {!leftRailHidden ? (
        <LeftRail
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onToggleCollapse={() => setLayout((current) => ({ ...current, leftRailHidden: true }))}
          onResizeStart={handleLeftRailResizeStart}
        />
      ) : null}
      <Workspace onOpenAssetLibrary={() => {
        setAssetLibraryRequest(undefined);
        setAssetLibraryOpen(true);
      }} />
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
      <PreflightTray />

      {leftRailHidden ? (
        <SurfaceButton
          className="collapsed-panel-tab collapsed-panel-tab-left"
          layout="stack"
          onClick={() => setLayout((current) => ({ ...current, leftRailHidden: false }))}
        >
          <StudioIcon icon={StudioIcons.panelLeftOpen} size={18} />
          <span>Panels</span>
        </SurfaceButton>
      ) : null}

      {rightInspectorHidden ? (
        <SurfaceButton
          className="collapsed-panel-tab collapsed-panel-tab-right"
          layout="stack"
          onClick={() => setLayout((current) => ({ ...current, rightInspectorHidden: false }))}
        >
          <span>Inspector</span>
          <StudioIcon icon={StudioIcons.panelRightOpen} size={18} />
        </SurfaceButton>
      ) : null}

      {timelineHidden ? (
        <SurfaceButton
          className="collapsed-panel-tab collapsed-panel-tab-bottom"
          onClick={() => setLayout((current) => ({ ...current, timelineHidden: false }))}
        >
          <StudioIcon icon={StudioIcons.panelBottomOpen} size={18} />
          <span>Timeline</span>
        </SurfaceButton>
      ) : null}
      {assetLibraryOpen ? (
        <Suspense fallback={null}>
          <AssetLibraryModal
            request={assetLibraryRequest}
            onClose={() => {
              setAssetLibraryOpen(false);
              setAssetLibraryRequest(undefined);
            }}
          />
        </Suspense>
      ) : null}
      {brandKitDrawerOpen ? (
        <Suspense fallback={null}>
          <BrandKitDrawer onClose={() => setBrandKitDrawerOpen(false)} />
        </Suspense>
      ) : null}
      <StudioKeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
