import { createId } from '../../domain/document/factories';
import type { WidgetNode, WidgetType } from '../../domain/document/types';
import {
  createInspectorTabs,
  type WidgetCapabilities,
  type WidgetDefinition,
  type WidgetLibraryGroup,
} from '../registry/widget-definition';
import { createModuleExportRenderer } from './module-exporter';
import type { PortableExportWidget } from '../../export/portable';
import type { WidgetSchemaDefinition } from '../../domain/widget-schema';

export type ModuleSpec = {
  type: WidgetType;
  label: string;
  category: 'interactive' | 'media' | 'content' | 'layout';
  libraryGroup?: WidgetLibraryGroup;
  libraryTags?: string[];
  libraryRank?: number;
  thumbnail?: WidgetDefinition['thumbnail'];
  renderLibraryPreview?: WidgetDefinition['renderLibraryPreview'];
  description?: WidgetDefinition['description'];
  recommendedSize?: WidgetDefinition['recommendedSize'];
  estimatedRuntimeKb?: WidgetDefinition['estimatedRuntimeKb'];
  requiresAsset?: WidgetDefinition['requiresAsset'];
  renderWireframe?: WidgetDefinition['renderWireframe'];
  mraidCompatibility?: WidgetDefinition['mraidCompatibility'];
  mraidCompatibilityNote?: WidgetDefinition['mraidCompatibilityNote'];
  frame: WidgetNode['frame'];
  props: Record<string, unknown>;
  style: Record<string, unknown>;
  renderStage: WidgetDefinition['renderStage'];
  renderInspector?: WidgetDefinition['renderInspector'];
  renderExport?: WidgetDefinition['renderExport'];
  inspectorFields?: WidgetDefinition['inspectorFields'];
  schema?: WidgetSchemaDefinition;
  capabilities?: WidgetCapabilities;
  exportDetail?: string;
  buildPortableExport?: WidgetDefinition['buildPortableExport'];
};

export function createModuleDefinition(spec: ModuleSpec): WidgetDefinition {
  return {
    type: spec.type,
    label: spec.label,
    category: spec.category,
    libraryGroup: spec.libraryGroup,
    libraryTags: spec.libraryTags,
    libraryRank: spec.libraryRank,
    thumbnail: spec.thumbnail,
    renderLibraryPreview: spec.renderLibraryPreview,
    description: spec.description,
    recommendedSize: spec.recommendedSize,
    estimatedRuntimeKb: spec.estimatedRuntimeKb,
    requiresAsset: spec.requiresAsset,
    renderWireframe: spec.renderWireframe,
    mraidCompatibility: spec.mraidCompatibility,
    mraidCompatibilityNote: spec.mraidCompatibilityNote,
    defaults: (sceneId, zIndex) => ({
      id: createId(spec.type.replace(/[^a-z]/g, '')),
      type: spec.type,
      name: spec.label,
      sceneId,
      zIndex,
      frame: spec.frame,
      props: { ...spec.props },
      style: { ...spec.style },
      timeline: { startMs: 0, endMs: 15000 },
    }),
    inspectorSections: [
      'position-size',
      'module-config',
      'fill',
      'timing',
      'states',
      'data-bindings',
      {
        key: 'variants',
        visibleWhen: (node) => Boolean(node.bindings && Object.keys(node.bindings).length > 0),
      },
    ],
    inspectorTabs: createInspectorTabs([
      { id: 'basics', label: 'Basics', panels: ['position-size', 'widget-fields', 'fill', 'timing'] },
      { id: 'behavior', label: 'Behavior', panels: ['conditions', 'actions', 'states', 'keyframes'] },
      { id: 'data', label: 'Data', panels: ['data-bindings', 'variants'] },
    ]),
    renderStage: spec.renderStage,
    renderInspector: spec.renderInspector,
    inspectorTitle: spec.label,
    inspectorFields: spec.inspectorFields,
    schema: spec.schema,
    capabilities: resolveModuleCapabilities(spec),
    renderExport: spec.renderExport ?? createModuleExportRenderer(spec.exportDetail ?? spec.label),
    buildPortableExport: spec.buildPortableExport ?? ((node) => buildModulePortableExport(node)),
    renderLabel: (node) => String(node.props.title ?? node.props.label ?? node.name),
  };
}

function resolveModuleCapabilities(spec: ModuleSpec): WidgetCapabilities {
  const imageAssetSwapTypes = new Set<WidgetType>(['image-carousel', 'interactive-gallery', 'shoppable-sidebar']);
  const videoAssetSwapTypes = new Set<WidgetType>(['interactive-video']);
  const galleryTypes = new Set<WidgetType>(['image-carousel', 'interactive-gallery', 'shoppable-sidebar']);
  const analyticsTypes = new Set<WidgetType>(['interactive-video']);

  return {
    hasFill: true,
    isMedia: spec.category === 'media' || imageAssetSwapTypes.has(spec.type) || videoAssetSwapTypes.has(spec.type),
    isInteractive: spec.category === 'interactive',
    exposesActions: true,
    hasTitleVariant: true,
    hasVideoAnalytics: analyticsTypes.has(spec.type) || spec.capabilities?.hasVideoAnalytics,
    isAssetGallery: galleryTypes.has(spec.type) || spec.capabilities?.isAssetGallery,
    acceptsImageAsset: imageAssetSwapTypes.has(spec.type) || spec.capabilities?.acceptsImageAsset,
    acceptsVideoAsset: videoAssetSwapTypes.has(spec.type) || spec.capabilities?.acceptsVideoAsset,
    acceptsAssetSwap:
      imageAssetSwapTypes.has(spec.type)
      || videoAssetSwapTypes.has(spec.type)
      || spec.capabilities?.acceptsAssetSwap,
    hasAccentColor: spec.capabilities?.hasAccentColor,
    acceptsFontAsset: spec.capabilities?.acceptsFontAsset,
    ...spec.capabilities,
  };
}

function buildModulePortableExport(node: WidgetNode): Partial<PortableExportWidget> {
  const exportRole = node.type;
  const patch: Partial<PortableExportWidget> = {
    props: {
      ...node.props,
      exportRole,
    },
  };

  switch (node.type) {
    case 'buttons':
      patch.props = {
        ...patch.props,
        primaryLabel: String(node.props.primaryLabel ?? ''),
        secondaryLabel: String(node.props.secondaryLabel ?? ''),
      };
      break;
    case 'interactive-gallery':
    case 'image-carousel':
      patch.props = {
        ...patch.props,
        galleryItems: String(node.props.slides ?? ''),
      };
      break;
    case 'interactive-hotspot':
      patch.props = {
        ...patch.props,
        hotspotX: Number(node.props.hotspotX ?? 50),
        hotspotY: Number(node.props.hotspotY ?? 50),
      };
      break;
    case 'range-slider':
    case 'slider':
      patch.props = {
        ...patch.props,
        min: Number(node.props.min ?? 0),
        max: Number(node.props.max ?? 100),
        value: Number(node.props.value ?? node.props.current ?? 0),
      };
      break;
    case 'scratch-reveal':
      patch.props = {
        ...patch.props,
        revealAmount: Number(node.props.revealAmount ?? 0),
      };
      break;
    default:
      break;
  }

  return patch;
}
