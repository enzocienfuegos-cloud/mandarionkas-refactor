import type { useStageController } from '../use-stage-controller';
import { createStageInteractionProps, STAGE_INTERACTION } from '../stage-interaction-targets';

type DropPreview = NonNullable<ReturnType<typeof useStageController>['dropPreview']>;

function buildStageDropGuideVerticalStyle(x: number): React.CSSProperties {
  return { left: x };
}

function buildStageDropGuideHorizontalStyle(y: number): React.CSSProperties {
  return { top: y };
}

function buildStageDropIndicatorStyle(x: number, y: number): React.CSSProperties {
  return { left: x, top: y };
}

function buildStageDropPillStyle(x: number, y: number): React.CSSProperties {
  return {
    left: Math.min(Math.max(x + 18, 12), 320),
    top: Math.max(y - 42, 12),
  };
}

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
      <div className="stage-drop-guide stage-drop-guide-vertical" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildStageDropGuideVerticalStyle(point.x)} />
      <div className="stage-drop-guide stage-drop-guide-horizontal" {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildStageDropGuideHorizontalStyle(point.y)} />
      <div className={`stage-drop-indicator ${preview.inBounds ? 'is-valid' : 'is-clamped'}`} {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildStageDropIndicatorStyle(point.x, point.y)} />
      <div className={`stage-drop-pill ${preview.inBounds ? 'is-valid' : 'is-clamped'}`} {...createStageInteractionProps(STAGE_INTERACTION.systemOverlay)} style={buildStageDropPillStyle(point.x, point.y)}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </>
  );
}
