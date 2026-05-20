import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml } from '../registry/export-helpers';
import {
  clampTokenImageFocal,
  clampTokenImageMaxSizePercent,
  clampTokenImageScalePercent,
  DEFAULT_TOKEN_IMAGE_FOCAL_X,
  DEFAULT_TOKEN_IMAGE_FOCAL_Y,
  normalizeTokenImageFit,
  parseDragTokenItems,
  tokenShapeToBorderRadius,
  type TokenShape,
} from './drag-token-pool.types';
import type { ExportRendererManifestEntry } from './export-registry';

function renderTokenHtml(
  token: ReturnType<typeof parseDragTokenItems>[number],
  tokenSize: number,
  radius: string,
  hideAccentForImageTokens: boolean,
  hideShapeForImageTokens: boolean,
  tokenImageMaxSizePercent: number,
  accentColor: string,
  sourceWidgetId: string,
  dropTargetId: string,
): string {
  const displayImageUrl = token.baseImageUrl ?? token.imageUrl ?? '';
  const imageFit = normalizeTokenImageFit(token.baseImageFit);
  const imageScalePercent = clampTokenImageScalePercent(token.baseImageScalePercent);
  const focalX = clampTokenImageFocal(token.baseImageFocalX, DEFAULT_TOKEN_IMAGE_FOCAL_X);
  const focalY = clampTokenImageFocal(token.baseImageFocalY, DEFAULT_TOKEN_IMAGE_FOCAL_Y);
  const hasImage = Boolean(displayImageUrl);
  const hideFrame = hasImage && hideAccentForImageTokens;
  const hideShape = hasImage && hideShapeForImageTokens;
  const effectiveRadius = hideShape ? '0' : radius;
  const border = hideFrame ? 'none' : `2px solid ${accentColor}`;
  const boxShadow = hideFrame ? 'none' : `0 0 14px ${accentColor}44`;
  const imageSize = `${tokenImageMaxSizePercent}%`;
  const usesFullFrame = imageFit === 'cover' || imageFit === 'fill';

  const tokenStyle = [
    `width:${tokenSize}px`,
    `height:${tokenSize}px`,
    `border-radius:${effectiveRadius}`,
    `border:${border}`,
    `box-shadow:${boxShadow}`,
    `overflow:hidden`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `background:transparent`,
    `color:#e5e7eb`,
    `font-size:11px`,
    `font-weight:700`,
    `text-align:center`,
    `padding:${hasImage ? '0' : '6px'}`,
    `user-select:none`,
    `-webkit-user-select:none`,
    `touch-action:none`,
    `pointer-events:auto`,
    `cursor:grab`,
    `position:relative`,
    `box-sizing:border-box`,
    `flex-shrink:0`,
  ].join(';');

  const imgStyle = hasImage ? [
    `max-width:${usesFullFrame ? '100%' : imageSize}`,
    `max-height:${usesFullFrame ? '100%' : imageSize}`,
    `width:${usesFullFrame ? '100%' : imageSize}`,
    `height:${usesFullFrame ? '100%' : imageSize}`,
    `object-fit:${imageFit}`,
    `object-position:${focalX}% ${focalY}%`,
    `border-radius:${hideShape ? '0' : 'inherit'}`,
    `transform:scale(${imageScalePercent / 100})`,
    `transform-origin:${focalX}% ${focalY}%`,
    `pointer-events:none`,
    `user-select:none`,
    `draggable:false`,
  ].join(';') : '';

  const inner = hasImage
    ? `<img src="${escapeHtml(displayImageUrl)}" alt="${escapeHtml(token.label)}" decoding="async" draggable="false" style="${imgStyle}" />`
    : escapeHtml(token.label);

  return `<div
    class="smx-drag-token"
    data-smx-action="token-drag"
    data-token-id="${escapeHtml(token.id)}"
    data-token-label="${escapeHtml(token.label)}"
    data-target-scene-id="${escapeHtml(token.targetSceneId ?? '')}"
    data-target-action-id="${escapeHtml(token.targetActionId ?? '')}"
    data-source-widget-id="${escapeHtml(sourceWidgetId)}"
    data-drop-target-id="${escapeHtml(dropTargetId)}"
    data-token-image="${escapeHtml(displayImageUrl)}"
    style="${tokenStyle}"
  ><span style="position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:100%;height:100%;">${inner}</span></div>`;
}

export function renderDragTokenPoolExport(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const tokens = parseDragTokenItems(node.props.tokens);
  const tokenSize = Math.max(32, Number(node.props.tokenSize ?? 72));
  const gap = Math.max(4, Number(node.props.gap ?? 16));
  const tokenShape: TokenShape =
    node.props.tokenShape === 'square' || node.props.tokenShape === 'rounded' || node.props.tokenShape === 'circle'
      ? node.props.tokenShape
      : 'circle';
  const hideAccentForImageTokens = node.props.hideAccentForImageTokens === true;
  const hideShapeForImageTokens = node.props.hideShapeForImageTokens === true;
  const tokenImageMaxSizePercent = clampTokenImageMaxSizePercent(node.props.tokenImageMaxSizePercent);
  const radius = tokenShapeToBorderRadius(tokenShape);
  const accentColor = String(style.accentColor ?? '#ffffff');
  const dropTargetId = String(node.props.dropTargetId ?? '').trim();

  const shellStyle = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `box-sizing:border-box`,
    `overflow:visible`,
  ].join(';');

  const trackStyle = [
    `display:flex`,
    `align-items:center`,
    `flex-wrap:wrap`,
    `justify-content:center`,
    `gap:${gap}px`,
  ].join(';');

  const tokenHtml = tokens
    .map((token) =>
      renderTokenHtml(
        token,
        tokenSize,
        radius,
        hideAccentForImageTokens,
        hideShapeForImageTokens,
        tokenImageMaxSizePercent,
        accentColor,
        node.id,
        dropTargetId,
      ),
    )
    .join('');

  return `<div class="widget widget-drag-token-pool" data-widget-id="${escapeHtml(node.id)}" data-drop-target-id="${escapeHtml(dropTargetId)}" style="${shellStyle}"><div style="${trackStyle}">${tokenHtml}</div></div>`;
}

export const dragTokenPoolExportRenderer: ExportRendererManifestEntry = {
  type: 'drag-token-pool',
  render: ({ node }) => renderDragTokenPoolExport(node as unknown as WidgetNode),
};
