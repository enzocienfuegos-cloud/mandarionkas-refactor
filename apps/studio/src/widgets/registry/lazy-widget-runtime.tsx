import { Suspense, createElement, lazy, type ComponentType } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetDefinition } from './widget-definition';

type StageComponent = ComponentType<{ node: WidgetNode; ctx: RenderContext }>;

function WidgetStageFallback({ label }: { label: string }): JSX.Element {
  return (
    <div className="widget-wireframe">
      <span className="widget-wireframe__label">{label}</span>
      <span className="widget-wireframe__dims">Loading module…</span>
    </div>
  );
}

function WidgetInspectorFallback({ title }: { title: string }): JSX.Element {
  return (
    <section className="section section-premium inspector-empty-card">
      <h3>{title}</h3>
      <small className="muted">Loading module controls…</small>
    </section>
  );
}

export function createLazyStageRenderer(
  label: string,
  loader: () => Promise<{ default: StageComponent }>,
): NonNullable<WidgetDefinition['renderStage']> {
  const LazyStage = lazy(loader);
  return (node, ctx) => (
    <Suspense fallback={<WidgetStageFallback label={label} />}>
      {createElement(LazyStage, { node, ctx })}
    </Suspense>
  );
}

export function createLazyInspectorRenderer<Props extends Record<string, unknown>>(
  title: string,
  loader: () => Promise<{ default: ComponentType<Props> }>,
  buildProps: (node: WidgetNode) => Props,
): NonNullable<WidgetDefinition['renderInspector']> {
  const LazyInspector = lazy(loader);
  const LazyInspectorComponent = LazyInspector as unknown as ComponentType<Props>;
  return (node) => (
    <Suspense fallback={<WidgetInspectorFallback title={title} />}>
      {createElement(LazyInspectorComponent, buildProps(node))}
    </Suspense>
  );
}
