import type { WidgetNode } from '../../domain/document/types';
import { escapeHtml, getBaseWidgetStyle, renderGenericExport, resolveExportHorizontalAlign, resolveExportTextAlign, resolveExportVerticalAlign } from './export-helpers';
import { resolveShapeKind } from '../shape/shape-shared';

export function renderTextExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};background:transparent;border:none;justify-content:${resolveExportVerticalAlign(node)};align-items:${resolveExportHorizontalAlign(node)};padding:0;text-align:${resolveExportTextAlign(node)};`;
  return `<div class="widget widget-text" data-widget-id="${node.id}" style="${base}">${escapeHtml(node.props.text ?? '')}</div>`;
}

export function renderCtaExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};cursor:pointer;justify-content:${resolveExportVerticalAlign(node)};align-items:${resolveExportHorizontalAlign(node)};text-align:${resolveExportTextAlign(node)};`;
  return `<button class="widget widget-cta" data-widget-id="${node.id}" style="${base}">${escapeHtml(node.props.text ?? node.name)}</button>`;
}

export function renderImageExport(node: WidgetNode, kind: 'image' | 'hero-image' = 'image'): string {
  const detail = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : 'Image placeholder')));
  return renderGenericExport(node, node.name, detail);
}

export function renderVideoExport(node: WidgetNode): string {
  return renderGenericExport(node, node.name, 'Video hero');
}

export function renderShapeExport(node: WidgetNode): string {
  const base = getBaseWidgetStyle(node);
  const shape = resolveShapeKind(node);
  const width = Number(node.frame.width ?? 0);
  const height = Number(node.frame.height ?? 0);
  const minSide = Math.max(0, Math.min(width, height));
  const fill = escapeHtml(String(node.style.backgroundColor ?? '#f6a11c'));
  const border = escapeHtml(String(node.style.borderColor ?? 'rgba(255,255,255,0.14)'));
  const maskSrc = escapeHtml(String(node.props.maskSrc ?? '').trim());
  const maskFit = escapeHtml(String(node.props.maskFit ?? 'cover'));
  const focalX = Number(node.props.maskFocalX ?? 50);
  const focalY = Number(node.props.maskFocalY ?? 50);

  let innerStyle = `width:100%;height:100%;background:${fill};border:1px solid ${border};box-sizing:border-box;`;
  let clipPath = '';

  if (shape === 'square') {
    innerStyle = `width:${minSide}px;height:${minSide}px;background:${fill};border:1px solid ${border};box-sizing:border-box;`;
  } else if (shape === 'circle') {
    innerStyle = `width:${minSide}px;height:${minSide}px;background:${fill};border-radius:50%;border:1px solid ${border};box-sizing:border-box;`;
    clipPath = 'circle(50% at 50% 50%)';
  } else if (shape === 'triangle') {
    innerStyle = `width:100%;height:100%;background:${fill};clip-path:polygon(50% 0%, 0% 100%, 100% 100%);border:1px solid ${border};box-sizing:border-box;`;
    clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  } else if (shape === 'line') {
    innerStyle = `width:100%;height:${Math.max(4, Math.min(10, height * 0.12))}px;background:${fill};border-radius:999px;border:1px solid ${border};box-sizing:border-box;`;
  } else if (shape === 'arrow') {
    innerStyle = `width:100%;height:100%;background:${fill};clip-path:polygon(0% 35%, 64% 35%, 64% 14%, 100% 50%, 64% 86%, 64% 65%, 0% 65%);border:1px solid ${border};box-sizing:border-box;`;
  }

  // With image mask: render img inside the clipped container
  if (maskSrc && clipPath) {
    const containerStyle = innerStyle.replace(`background:${fill};`, 'background:transparent;')
      + `overflow:hidden;clip-path:${clipPath};position:relative;border:none;`;
    const imgStyle = `position:absolute;inset:0;width:100%;height:100%;object-fit:${maskFit};object-position:${focalX}% ${focalY}%;display:block;pointer-events:none;`;
    return `<div class="widget widget-shape" data-widget-id="${node.id}" style="${base};display:flex;align-items:center;justify-content:center;padding:0;"><div style="${containerStyle}"><img src="${maskSrc}" alt="" style="${imgStyle}" /></div></div>`;
  }

  return `<div class="widget widget-shape" data-widget-id="${node.id}" style="${base};display:flex;align-items:center;justify-content:center;padding:0;"><div style="${innerStyle}"></div></div>`;
}

