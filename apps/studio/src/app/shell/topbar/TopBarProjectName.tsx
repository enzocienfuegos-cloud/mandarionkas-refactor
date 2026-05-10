import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../../../shared/ui/Tooltip';
import { CanvasSizePicker } from './CanvasSizePicker';
import type { TopBarController } from './use-top-bar-controller';

function buildBreadcrumb(controller: TopBarController): string {
  const parts = [
    controller.workspace.activeClient?.name ?? controller.snapshot.platformMeta?.clientName,
    controller.snapshot.platformMeta?.brandName,
    controller.snapshot.platformMeta?.campaignName,
  ].filter(Boolean);

  return parts.length ? parts.join(' / ') : 'Studio workspace';
}

export function buildSceneLabel(controller: TopBarController): string {
  const index = controller.snapshot.scenes.findIndex((scene) => scene.id === controller.snapshot.activeSceneId);
  const activeScene = controller.snapshot.scenes[index];
  if (!activeScene) return 'Scene';
  const base = activeScene.name?.trim() ? activeScene.name : `Scene ${index + 1}`;
  return index >= 0 ? `${index + 1}. ${base}` : base;
}

function getSaveIndicator(
  controller: TopBarController,
): { tone: 'saved' | 'saving' | 'unsaved'; label: string } {
  const { dirty } = controller.snapshot;
  const { saveStatus } = controller.projectSession;

  if (saveStatus === 'saving') {
    return { tone: 'saving', label: 'Saving changes' };
  }

  if (!dirty && saveStatus === 'saved') {
    return { tone: 'saved', label: 'Project saved' };
  }

  return { tone: 'unsaved', label: 'Unsaved changes' };
}

export function TopBarProjectName({ controller }: { controller: TopBarController }): JSX.Element {
  const { name, canvasPresetId, state } = controller.snapshot;
  const { canvas } = state.document;
  const { documentActions } = controller.document;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const breadcrumb = buildBreadcrumb(controller);
  const saveIndicator = getSaveIndicator(controller);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function commitName(): void {
    const nextValue = draftName.trim() || 'Untitled Project';
    documentActions.updateName(nextValue);
    setDraftName(nextValue);
    setEditing(false);
  }

  return (
    <div className="top-project-shell">
      <div className="top-project-identity">
        {editing ? (
          <input
            ref={inputRef}
            aria-label="Project name"
            className="top-project-name-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName();
              if (event.key === 'Escape') {
                setDraftName(name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <Tooltip content={breadcrumb}>
            <button
              type="button"
              className="top-project-name-button"
              onClick={() => setEditing(true)}
            >
              {name || 'Untitled Project'}
            </button>
          </Tooltip>
        )}

        <CanvasSizePicker
          presetId={canvasPresetId}
          width={canvas.width}
          height={canvas.height}
          onPresetChange={documentActions.applyCanvasPreset}
          onCustomSize={documentActions.updateCanvasSize}
        />

        <Tooltip content={saveIndicator.label}>
          <span
            className={`top-save-indicator ${saveIndicator.tone === 'saved' ? 'is-saved' : ''} ${saveIndicator.tone === 'saving' ? 'is-saving' : ''}`.trim()}
            aria-label={saveIndicator.label}
          />
        </Tooltip>
      </div>
    </div>
  );
}
