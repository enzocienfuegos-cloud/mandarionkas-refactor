import { CANVAS_PRESETS } from '../../../domain/document/canvas-presets';
import type { TopBarController } from './use-top-bar-controller';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Button } from '../../../shared/ui/Button';
import { getPreviewFrame, PREVIEW_FRAMES } from '../../../domain/preview/preview-frames';

const ZOOM_OPTIONS = [25, 50, 75, 100, 125, 150, 200] as const;

function formatCanvasOptionLabel(presetId: string, width: number, height: number): string {
  const preset = CANVAS_PRESETS.find((item) => item.id === presetId);
  if (!preset || preset.id === 'custom') {
    return `Custom · ${width}×${height}`;
  }
  return preset.label;
}

function fitZoomForWorkspace(args: {
  canvas: { width: number; height: number };
  previewMode: boolean;
  previewContext: import('../../../domain/preview/preview-frames').PreviewFrameId;
}): number {
  const { canvas, previewMode, previewContext } = args;
  const workspace = document.querySelector('.workspace-shell');
  if (!(workspace instanceof HTMLDivElement)) return 1;
  const bounds = workspace.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return 1;
  const previewFrame = previewMode ? getPreviewFrame(previewContext) : getPreviewFrame('none');
  const frameWidth = previewFrame.id === 'none' ? canvas.width : previewFrame.chromeWidth;
  const frameHeight = previewFrame.id === 'none' ? canvas.height : previewFrame.chromeHeight;
  return Math.min(
    Math.max(0.25, (Math.max(1, bounds.width - 96) / frameWidth)),
    Math.max(0.25, (Math.max(1, bounds.height - 96) / frameHeight)),
    1,
  );
}

export function TopBarCenterContent({ controller }: { controller: TopBarController }): JSX.Element {
  const { previewMode, previewContext, zoom, state } = controller.snapshot;
  const { canvasPresetId } = controller.snapshot;
  const { documentActions, uiActions } = controller.document;
  const { canvas } = state.document;
  const zoomValue = Math.round(zoom * 100);
  const zoomSelectValue = ZOOM_OPTIONS.includes(zoomValue as typeof ZOOM_OPTIONS[number]) ? String(zoomValue) : 'fit';
  const canvasOptionLabel = formatCanvasOptionLabel(canvasPresetId, canvas.width, canvas.height);

  return (
    <div className="top-center-shell">
      <div className="top-center-controls" role="group" aria-label="Preview and viewport controls">
        <Button
          variant="ghost"
          size="sm"
          className={`top-preview-toggle ${previewMode ? 'is-active' : ''}`}
          aria-pressed={previewMode}
          iconBefore={<StudioIcon icon={previewMode ? StudioIcons.play : StudioIcons.scanSearch} size={14} />}
          onClick={() => uiActions.setPreviewMode(!previewMode)}
        >
          {previewMode ? 'Exit Preview' : 'Preview'}
        </Button>

        {previewMode ? (
          <div className="top-select-shell">
            <span className="top-select-shell__icon" aria-hidden="true">
              <StudioIcon icon={StudioIcons.smartphone} size={14} />
            </span>
            <select
              className="top-select-control"
              aria-label="Preview frame"
              value={previewContext}
              onChange={(event) => uiActions.setPreviewContext(event.target.value as typeof previewContext)}
            >
              {PREVIEW_FRAMES.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="top-select-shell">
          <span className="top-select-shell__icon" aria-hidden="true">
            <StudioIcon icon={StudioIcons.boxes} size={14} />
          </span>
          <select
            className="top-select-control"
            aria-label="Canvas size preset"
            value={canvasPresetId}
            onChange={(event) => documentActions.applyCanvasPreset(event.target.value)}
          >
            {CANVAS_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.id === 'custom' ? canvasOptionLabel : preset.label}
              </option>
            ))}
          </select>
        </div>

        {canvasPresetId === 'custom' ? (
          <div className="top-custom-size">
            <input
              aria-label="Custom canvas width"
              type="number"
              min={1}
              value={canvas.width}
              onChange={(event) => documentActions.updateCanvasSize(Number(event.target.value) || 1, canvas.height)}
            />
            <span className="top-custom-size__separator">×</span>
            <input
              aria-label="Custom canvas height"
              type="number"
              min={1}
              value={canvas.height}
              onChange={(event) => documentActions.updateCanvasSize(canvas.width, Number(event.target.value) || 1)}
            />
          </div>
        ) : null}

        <div className="top-select-shell">
          <span className="top-select-shell__icon" aria-hidden="true">
            <StudioIcon icon={StudioIcons.maximize} size={14} />
          </span>
          <select
            className="top-select-control"
            aria-label="Canvas zoom"
            value={zoomSelectValue}
            onChange={(event) => {
              if (event.target.value === 'fit') {
                uiActions.setZoom(fitZoomForWorkspace({ canvas, previewMode, previewContext }));
                return;
              }
              uiActions.setZoom(Number(event.target.value) / 100);
            }}
          >
            {ZOOM_OPTIONS.map((value) => <option key={value} value={String(value)}>{value}%</option>)}
            <option value="fit">Fit</option>
          </select>
        </div>
      </div>
    </div>
  );
}
