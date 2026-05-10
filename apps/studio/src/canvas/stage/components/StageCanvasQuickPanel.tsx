import type { CSSProperties } from 'react';
import { STAGE_BACKGROUND_SWATCHES, TRANSPARENT_CANVAS_BACKGROUND } from '../../../domain/document/canvas-presets';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

function buildStageSwatchStyle(background: string): CSSProperties {
  return { background };
}

type StageCanvasQuickPanelProps = {
  canvas: { width: number; height: number; backgroundColor: string };
  onUpdateBackground(background: string): void;
};

export function StageCanvasQuickPanel({ canvas, onUpdateBackground }: StageCanvasQuickPanelProps): JSX.Element {
  return (
    <div className="stage-canvas-quick-panel">
      <div className="stage-canvas-quick-panel__header">
        <strong>Canvas background</strong>
        <span>{canvas.width}×{canvas.height}</span>
      </div>
      <div className="stage-canvas-quick-panel__swatches">
        <button
          type="button"
          className={`stage-canvas-quick-panel__swatch stage-canvas-quick-panel__swatch--transparent ${canvas.backgroundColor === TRANSPARENT_CANVAS_BACKGROUND ? 'is-active' : ''}`}
          aria-label="Use transparent canvas background"
          onClick={() => onUpdateBackground(TRANSPARENT_CANVAS_BACKGROUND)}
        >
          <span className="stage-canvas-quick-panel__swatch-icon" aria-hidden="true">
            <StudioIcon icon={StudioIcons.x} size={14} />
          </span>
          <span className="stage-canvas-quick-panel__swatch-label">Transparent</span>
        </button>
        {STAGE_BACKGROUND_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`stage-canvas-quick-panel__swatch ${canvas.backgroundColor.toLowerCase() === swatch.toLowerCase() ? 'is-active' : ''}`}
            style={buildStageSwatchStyle(swatch)}
            aria-label={`Use ${swatch}`}
            onClick={() => onUpdateBackground(swatch)}
          />
        ))}
      </div>
      <label className="stage-canvas-quick-panel__field">
        <span>Custom</span>
        <input
          type="color"
          aria-label="Canvas background color"
          value={canvas.backgroundColor === TRANSPARENT_CANVAS_BACKGROUND ? '#ffffff' : canvas.backgroundColor}
          onChange={(event) => onUpdateBackground(event.target.value)}
        />
      </label>
    </div>
  );
}
