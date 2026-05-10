import type { TopBarController } from './use-top-bar-controller';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Button } from '../../../shared/ui/Button';
import { getPreviewFrame, PREVIEW_FRAMES } from '../../../domain/preview/preview-frames';
import { CanvasSizePicker } from './CanvasSizePicker';

const ZOOM_OPTIONS = [25, 50, 75, 100, 125, 150, 200] as const;

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

        <CanvasSizePicker
          presetId={canvasPresetId}
          width={canvas.width}
          height={canvas.height}
          onPresetChange={documentActions.applyCanvasPreset}
          onCustomSize={documentActions.updateCanvasSize}
        />

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
