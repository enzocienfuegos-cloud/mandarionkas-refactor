import type { StudioState, WidgetFrame, WidgetNode } from '../../domain/document/types';
import { renderGenericExport } from '../registry/export-helpers';
import { getWidgetDefinition } from '../registry/widget-registry';

type ScratchCoverOptions = {
  node: WidgetNode;
  state: StudioState;
  widgetsById: Record<string, WidgetNode>;
  rootFrame: WidgetFrame;
  resolveFrame: (widget: WidgetNode) => WidgetFrame;
  resolveOpacity?: (widget: WidgetNode) => number;
  shouldIncludeWidget?: (widget: WidgetNode) => boolean;
  assetPathMap?: Record<string, string>;
};

function renderScratchCoverNode(
  current: WidgetNode,
  options: ScratchCoverOptions,
  visited = new Set<string>(),
): string[] {
  if (visited.has(current.id) || current.hidden || (options.shouldIncludeWidget && !options.shouldIncludeWidget(current))) return [];
  visited.add(current.id);

  if (current.type === 'group' && current.childIds?.length) {
    return current.childIds
      .map((childId) => options.widgetsById[childId])
      .filter((child): child is WidgetNode => Boolean(child))
      .sort((left, right) => left.zIndex - right.zIndex)
      .flatMap((child) => renderScratchCoverNode(child, options, visited));
  }

  const frame = options.resolveFrame(current);
  const relativeChild: WidgetNode = {
    ...current,
    frame: {
      ...frame,
      x: frame.x - options.rootFrame.x,
      y: frame.y - options.rootFrame.y,
    },
    style: {
      ...current.style,
      opacity: options.resolveOpacity ? options.resolveOpacity(current) : current.style?.opacity,
    },
  };
  const definition = getWidgetDefinition(relativeChild.type);
  if (definition.renderExport) {
    return [definition.renderExport(relativeChild, options.state, options.assetPathMap ?? {})];
  }
  return [renderGenericExport(relativeChild, relativeChild.name, relativeChild.type)];
}

function buildScratchCoverMarkup(options: ScratchCoverOptions): string {
  return (options.node.childIds ?? [])
    .map((childId) => options.widgetsById[childId])
    .filter((child): child is WidgetNode => Boolean(child))
    .sort((left, right) => left.zIndex - right.zIndex)
    .flatMap((child) => renderScratchCoverNode(child, options))
    .join('\n');
}

export function buildScratchGroupCoverDataUrl(options: ScratchCoverOptions): string {
  const width = Math.max(1, Math.round(options.rootFrame.width));
  const height = Math.max(1, Math.round(options.rootFrame.height));
  const markup = buildScratchCoverMarkup(options);
  if (!markup.trim()) return '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;background:transparent;box-sizing:border-box;">
          ${markup}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
