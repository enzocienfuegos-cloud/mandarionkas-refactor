import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { StageSurface } from '../../canvas/stage/components/StageSurface';
import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';
import { isWidgetVisibleAt } from '../../domain/document/timeline';
import type { StudioState, WidgetNode } from '../../domain/document/types';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { isEditableShortcutTarget } from '../../app/shell/use-keyboard-shortcuts';
import type { ClientPreviewThread } from './types';

function formatPlaybackTime(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ClientPreviewPlayer({
  state,
  sceneIndex,
  threads,
  activeThreadId,
  pinMode,
  onTogglePinMode,
  onSelectThread,
  onCreatePinnedThread,
}: {
  state: StudioState;
  sceneIndex: number;
  threads: ClientPreviewThread[];
  activeThreadId: string | null;
  pinMode: boolean;
  onTogglePinMode(): void;
  onSelectThread(threadId: string): void;
  onCreatePinnedThread(pin: { xPct: number; yPct: number; sceneIndex: number }): void;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  const playheadRef = useRef(0);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [playbackBounds, setPlaybackBounds] = useState({ width: 0, height: 0 });
  const scene = state.document.scenes[sceneIndex] ?? state.document.scenes[0];
  const canvas = state.document.canvas;
  const widgetsById = useMemo(() => buildResolvedWidgetsById(state.document), [state.document]);
  const widgets = useMemo(
    () => scene.widgetIds.map((id) => widgetsById[id]).filter(Boolean) as WidgetNode[],
    [scene.widgetIds, widgetsById],
  );
  const visibleThreads = threads.filter((thread) => thread.pin?.sceneIndex === sceneIndex);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    setPlayheadMs(0);
    playheadRef.current = 0;
    setIsPlaying(true);
  }, [scene.id]);

  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const updateScale = () => {
      const nextScale = Math.min(
        1,
        (host.clientWidth - 24) / Math.max(1, canvas.width),
        (host.clientHeight - 24) / Math.max(1, canvas.height),
      );
      setFitScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
      setPlaybackBounds({ width: canvas.width * nextScale, height: canvas.height * nextScale });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(host);
    return () => observer.disconnect();
  }, [canvas.height, canvas.width]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const reactSyncIntervalMs = 250;
    let frame = 0;
    let lastTime: number | null = null;
    let lastSyncedMs = playheadRef.current;
    const tick = (now: number) => {
      if (lastTime === null) {
        lastTime = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      const next = Math.min(scene.durationMs, playheadRef.current + (now - lastTime));
      lastTime = now;
      playheadRef.current = next;
      if (next - lastSyncedMs >= reactSyncIntervalMs || next >= scene.durationMs) {
        lastSyncedMs = next;
        setPlayheadMs(next);
      }
      if (next >= scene.durationMs) {
        setIsPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, scene.durationMs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();
      setIsPlaying((current) => {
        if (current) return false;
        if (playheadRef.current >= scene.durationMs) {
          playheadRef.current = 0;
          setPlayheadMs(0);
        }
        return true;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene.durationMs]);

  return (
    <div ref={hostRef} className="cp-stage">
      <div className="cp-banner-frame" style={{ width: playbackBounds.width || canvas.width, height: playbackBounds.height || canvas.height }}>
        <div
          className="cp-banner-stage"
          style={{ width: playbackBounds.width || canvas.width, height: playbackBounds.height || canvas.height, cursor: pinMode ? 'crosshair' : 'default' }}
          onClick={(event) => {
            if (!pinMode) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            const xPct = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
            const yPct = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100;
            onCreatePinnedThread({ xPct, yPct, sceneIndex });
          }}
        >
          <div className="cp-banner-surface">
            <StageSurface
              stageRef={stageRef}
              canvas={canvas}
              widgets={widgets}
              widgetsById={widgetsById}
              selectedIds={[]}
              previewMode
              isPlaying={isPlaying}
              editModeWireframe={false}
              zoom={fitScale}
              playheadMs={playheadMs}
              sceneDurationMs={scene.durationMs}
              sceneTransitionType="cut"
              sceneTransitionDurationMs={0}
              sceneTransitionActive={false}
              marquee={null}
              dropPreview={null}
              liveFrameById={{}}
              showStageRulers={false}
              showWidgetBadges={false}
              stateRef={stateRef}
              isWidgetVisible={(widgetId) => {
                const widget = stateRef.current.document.widgets[widgetId];
                return widget ? isWidgetVisibleAt(widget, playheadMs) : false;
              }}
              onStagePointerDown={() => undefined}
              onStageDragOver={() => undefined}
              onStageDragLeave={() => undefined}
              onStageDrop={() => undefined}
              onWidgetPointerDown={() => undefined}
              onResizePointerDown={() => undefined}
              onSetActiveWidget={() => undefined}
              onSetHoveredWidget={() => undefined}
              onExecuteAction={() => undefined}
            />
          </div>

          {visibleThreads.map((thread, index) => {
            if (!thread.pin) return null;
            return (
              <button
                key={thread.id}
                type="button"
                className={`cp-comment-pin ${activeThreadId === thread.id ? 'is-active' : ''}`.trim()}
                style={{ left: `${thread.pin.xPct}%`, top: `${thread.pin.yPct}%` }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectThread(thread.id);
                }}
              >
                <span className="cp-comment-pin__number">{index + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="cp-playback">
          <button
            type="button"
            className="cp-play-btn"
            onClick={() => {
              if (playheadMs >= scene.durationMs) {
                playheadRef.current = 0;
                setPlayheadMs(0);
              }
              setIsPlaying((current) => !current);
            }}
          >
            <StudioIcon icon={isPlaying ? StudioIcons.pause : StudioIcons.play} size={14} />
          </button>
          <div
            className="cp-progress"
            style={{ '--cp-progress': `${(playheadMs / Math.max(1, scene.durationMs)) * 100}%` } as CSSProperties}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
              setPlayheadMs(scene.durationMs * ratio);
            }}
          >
            <span className="cp-progress-fill" />
          </div>
          <span className="cp-time">{formatPlaybackTime(playheadMs)} / {formatPlaybackTime(scene.durationMs)}</span>
          <Button
            variant={pinMode ? 'primary' : 'ghost'}
            size="sm"
            className="cp-pin-toggle"
            iconBefore={<StudioIcon icon={StudioIcons.circle} size={12} />}
            onClick={onTogglePinMode}
          >
            Pin comment
          </Button>
        </div>
      </div>
    </div>
  );
}
