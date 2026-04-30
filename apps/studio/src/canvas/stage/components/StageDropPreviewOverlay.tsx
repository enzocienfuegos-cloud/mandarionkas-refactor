import type { useStageController } from '../use-stage-controller';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

type DropPreview = NonNullable<ReturnType<typeof useStageController>['dropPreview']>;

export function StageDropPreviewOverlay({ preview }: { preview: DropPreview }): JSX.Element {
  const point = preview.inBounds ? preview.point : preview.clampedPoint;
  const labelX = Math.round(point.x);
  const labelY = Math.round(point.y);
  const title = preview.payload.kind === 'widget-library-item'
    ? preview.payload.widgetLabel
    : `${preview.payload.assetKind === 'video' ? 'Video' : preview.payload.assetKind === 'font' ? 'Font' : 'Image'} · ${preview.payload.assetName}`;
  const subtitle = preview.payload.kind === 'widget-library-item'
    ? `${labelX}px · ${labelY}px`
    : `${preview.payload.assetKind} drop · ${labelX}px · ${labelY}px`;

  return (
    <>
      <div className="stage-drop-guide stage-drop-guide-vertical" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={{ left: point.x }} />
      <div className="stage-drop-guide stage-drop-guide-horizontal" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={{ top: point.y }} />
      <div className={`stage-drop-indicator ${preview.inBounds ? 'is-valid' : 'is-clamped'}`} {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={{ left: point.x, top: point.y }} />
      <div className={`stage-drop-pill ${preview.inBounds ? 'is-valid' : 'is-clamped'}`} {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={{ left: Math.min(Math.max(point.x + 18, 12), 320), top: Math.max(point.y - 42, 12) }}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </>
  );
}
