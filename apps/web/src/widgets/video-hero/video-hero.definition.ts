import { createId } from '../../domain/document/factories';
import { renderVideoHeroWidget } from './video-hero.renderer';
import { createInspectorTabs, type WidgetDefinition } from '../registry/widget-definition';
import { renderVideoExport } from '../registry/base-exporters';

export const videoHeroDefinition: WidgetDefinition = {
  type: 'video-hero',
  label: 'Video Hero',
  category: 'media',
  defaults: (sceneId, zIndex) => ({
    id: createId('videohero'),
    type: 'video-hero',
    name: 'Video Hero',
    sceneId,
    zIndex,
    frame: { x: 40, y: 80, width: 260, height: 144, rotation: 0 },
    props: { src: '', posterSrc: '', autoplay: true, muted: true, loop: true, controls: false },
    style: { backgroundColor: '#0f172a', fit: 'cover', borderRadius: 18 },
    timeline: { startMs: 0, endMs: 15000 },
  }),
  inspectorSections: ['position-size', 'fill', 'timing', 'states', 'data-bindings', 'variants'],
  inspectorTabs: createInspectorTabs([
    { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
    { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
    { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
  ]),
  inspectorTitle: 'Video settings',
  inspectorFields: [{ key: 'src', label: 'Video URL' }, { key: 'posterSrc', label: 'Poster URL' }, { key: 'autoplay', type: 'checkbox' }, { key: 'muted', type: 'checkbox' }, { key: 'loop', type: 'checkbox' }, { key: 'controls', type: 'checkbox' }],
  renderStage: renderVideoHeroWidget,
  renderExport: (node) => renderVideoExport(node),
  buildPortableExport: (node) => ({
    props: {
      ...node.props,
      exportRole: 'video-hero',
      src: String(node.props.src ?? ''),
      posterSrc: String(node.props.posterSrc ?? ''),
      autoplay: Boolean(node.props.autoplay ?? true),
      muted: Boolean(node.props.muted ?? true),
      loop: Boolean(node.props.loop ?? true),
      controls: Boolean(node.props.controls ?? false),
      fit: String(node.style.fit ?? 'cover'),
    },
  }),
  renderLabel: () => 'Video Hero',
};
