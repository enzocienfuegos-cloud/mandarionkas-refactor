import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { StudioState } from '../../domain/document/types';
import { buildGenericHtml5Adapter } from '../../export/adapters/generic-html5';
import { buildChannelHtml } from '../../export/html';
import { compileRuntime } from '../../export/runtime-script';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { isEditableShortcutTarget } from '../../app/shell/use-keyboard-shortcuts';
import type { ClientPreviewThread } from './types';

export function buildClientPreviewSceneState(state: StudioState, sceneIndex: number): StudioState {
  const scene = state.document.scenes[sceneIndex] ?? state.document.scenes[0];
  if (!scene) return state;
  return {
    ...state,
    document: {
      ...state.document,
      scenes: [{ ...scene, order: 0 }],
      selection: {
        ...state.document.selection,
        activeSceneId: scene.id,
      },
    },
    ui: {
      ...state.ui,
      playheadMs: 0,
      isPlaying: true,
      previewMode: true,
    },
  };
}

export function buildClientPreviewSceneHtml(state: StudioState, sceneIndex: number): string {
  const sceneState = buildClientPreviewSceneState(state, sceneIndex);
  const adapter = buildGenericHtml5Adapter(sceneState);
  const runtimeScript = compileRuntime(adapter.portableProject, adapter);
  const safeRuntimeScript = runtimeScript.replace(/<\/script>/gi, '<\\/script>');
  return buildChannelHtml(sceneState, adapter, { assetPathMap: {} }).replace(
    '<script src="./runtime.js"></script>',
    `<script>${safeRuntimeScript}</script>`,
  );
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [fitScale, setFitScale] = useState(1);
  const [playbackBounds, setPlaybackBounds] = useState({ width: 0, height: 0 });
  const [replayRevision, setReplayRevision] = useState(0);
  const scene = state.document.scenes[sceneIndex] ?? state.document.scenes[0];
  const canvas = state.document.canvas;
  const visibleThreads = threads.filter((thread) => thread.pin?.sceneIndex === sceneIndex);
  const previewHtml = useMemo(() => buildClientPreviewSceneHtml(state, sceneIndex), [sceneIndex, state]);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();
      setReplayRevision((current) => current + 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setReplayRevision((current) => current + 1);
  }, [scene.id]);

  function createPinFromEvent(event: MouseEvent<HTMLElement>): void {
    if (!pinMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPct = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
    const yPct = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100;
    onCreatePinnedThread({ xPct, yPct, sceneIndex });
  }

  return (
    <div ref={hostRef} className="cp-stage">
      <div className="cp-banner-frame" style={{ width: playbackBounds.width || canvas.width, height: playbackBounds.height || canvas.height }}>
        <div
          className="cp-banner-stage"
          style={{ width: playbackBounds.width || canvas.width, height: playbackBounds.height || canvas.height, cursor: pinMode ? 'crosshair' : 'default' }}
        >
          <div className="cp-banner-surface">
            <iframe
              key={`${scene.id}-${replayRevision}`}
              ref={iframeRef}
              className="cp-banner-iframe"
              title={`${scene.name} preview`}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              srcDoc={previewHtml}
              style={{
                width: canvas.width,
                height: canvas.height,
                transform: `scale(${fitScale})`,
              }}
            />
          </div>

          {pinMode ? (
            <button
              type="button"
              className="cp-pin-capture"
              aria-label="Place comment pin"
              onClick={createPinFromEvent}
            />
          ) : null}

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
            onClick={() => setReplayRevision((current) => current + 1)}
            aria-label="Replay preview"
          >
            <StudioIcon icon={StudioIcons.play} size={14} />
          </button>
          <span className="cp-time">Runtime preview · GSAP</span>
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
