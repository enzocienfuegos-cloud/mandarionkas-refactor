import type { StudioState, WidgetNode, WidgetType } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { PortableExportWidget } from '../../export/portable';
import type { WidgetSchemaDefinition } from '../../domain/widget-schema';

export type InspectorSectionKey =
  | 'position-size'
  | 'text-content'
  | 'fill'
  | 'overlay'
  | 'shadow'
  | 'timing'
  | 'module-config'
  | 'states'
  | 'data-bindings'
  | 'variants'
  | 'conditions'
  | 'document-meta';

export type WidgetInspectorTabId = 'basics' | 'behavior' | 'data';

export type WidgetInspectorPanelKey =
  | 'position-size'
  | 'text-content'
  | 'widget-fields'
  | 'module-config'
  | 'fill'
  | 'overlay'
  | 'shadow'
  | 'timing'
  | 'conditions'
  | 'actions'
  | 'motion'
  | 'states'
  | 'keyframes'
  | 'data-bindings'
  | 'variants';

export type WidgetInspectorTabSpec = {
  id: WidgetInspectorTabId;
  label?: string;
  panels: WidgetInspectorPanelKey[];
};

export type WidgetFieldSpec = {
  key: string;
  label?: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'select';
  options?: Array<{ label: string; value: string }>;
};

export type WidgetAssetKind = 'image' | 'video' | 'font';

export type WidgetLibraryGroup =
  | 'essentials'
  | 'commerce'
  | 'video-social'
  | 'interactive'
  | 'data-utility'
  | 'premium-fx';

export const WIDGET_LIBRARY_GROUP_ORDER: WidgetLibraryGroup[] = [
  'essentials',
  'commerce',
  'video-social',
  'interactive',
  'data-utility',
  'premium-fx',
];

export const WIDGET_LIBRARY_GROUP_LABELS: Record<WidgetLibraryGroup, string> = {
  essentials: 'Essentials',
  commerce: 'Commerce',
  'video-social': 'Video / Social',
  interactive: 'Interactive',
  'data-utility': 'Data / Utility',
  'premium-fx': 'Premium FX',
};

export type WidgetCapabilities = {
  supportsMotion?: boolean;
  supportsHoverMotion?: boolean;
  acceptsImageAsset?: boolean;
  acceptsVideoAsset?: boolean;
  acceptsFontAsset?: boolean;
  acceptsAssetSwap?: boolean;
  hasFill?: boolean;
  hasAccentColor?: boolean;
  isMedia?: boolean;
  isInteractive?: boolean;
  exposesActions?: boolean;
  isContainer?: boolean;
  hasVideoAnalytics?: boolean;
  hasTextVariant?: boolean;
  hasTitleVariant?: boolean;
  isAssetGallery?: boolean;
  performsNetworkIo?: boolean;
  worksOffline?: boolean;
  requiresMraidHost?: boolean;
  hasInaccessibleInteractions?: boolean;
  hasRuntimeRandomness?: boolean;
};

export type InspectorSectionEntry =
  | InspectorSectionKey
  | { key: InspectorSectionKey; visibleWhen: (node: WidgetNode, state: StudioState) => boolean };

export type WidgetDefinition = {
  type: WidgetType;
  label: string;
  category: 'content' | 'media' | 'interactive' | 'layout';
  libraryGroup?: WidgetLibraryGroup;
  libraryTags?: string[];
  libraryRank?: number;
  thumbnail?: string | (() => JSX.Element);
  renderLibraryPreview?: () => JSX.Element;
  description?: string;
  recommendedSize?: { width: number; height: number; label?: string };
  estimatedRuntimeKb?: number;
  requiresAsset?: boolean;
  renderWireframe?: (node: WidgetNode, ctx: RenderContext) => JSX.Element;
  mraidCompatibility?: 'supported' | 'warning' | 'blocked';
  mraidCompatibilityNote?: string;
  defaults: (sceneId: string, zIndex: number) => WidgetNode;
  inspectorSections: InspectorSectionEntry[];
  inspectorTabs?: WidgetInspectorTabSpec[];
  inspectorTitle?: string;
  inspectorFields?: WidgetFieldSpec[];
  schema?: WidgetSchemaDefinition;
  capabilities?: WidgetCapabilities;
  renderLabel: (node: WidgetNode) => string;
  renderStage?: (node: WidgetNode, ctx: RenderContext) => JSX.Element;
  renderInspector?: (node: WidgetNode) => JSX.Element;
  renderExport?: (node: WidgetNode, state: StudioState, assetPathMap?: Record<string, string>) => string;
  buildPortableExport?: (node: WidgetNode, state: StudioState) => Partial<PortableExportWidget> | void;
};

export function getCapability<K extends keyof WidgetCapabilities>(
  definition: Pick<WidgetDefinition, 'capabilities'>,
  key: K,
): WidgetCapabilities[K] {
  return definition.capabilities?.[key];
}

export function getAcceptedAssetKinds(definition: Pick<WidgetDefinition, 'capabilities'>): WidgetAssetKind[] {
  const acceptedKinds: WidgetAssetKind[] = [];
  if (definition.capabilities?.acceptsImageAsset) acceptedKinds.push('image');
  if (definition.capabilities?.acceptsVideoAsset) acceptedKinds.push('video');
  if (definition.capabilities?.acceptsFontAsset) acceptedKinds.push('font');
  return acceptedKinds;
}

export function acceptsAssetKind(
  definition: Pick<WidgetDefinition, 'capabilities'>,
  kind: WidgetAssetKind,
): boolean {
  return getAcceptedAssetKinds(definition).includes(kind);
}

export function createInspectorTabs(tabs: WidgetInspectorTabSpec[]): WidgetInspectorTabSpec[] {
  return tabs.map((tab) => ({ ...tab, panels: [...tab.panels] }));
}

export function normalizeInspectorSectionKey(entry: InspectorSectionEntry): InspectorSectionKey {
  return typeof entry === 'string' ? entry : entry.key;
}

export function hasInspectorSection(
  definition: Pick<WidgetDefinition, 'inspectorSections'>,
  key: InspectorSectionKey,
): boolean {
  return definition.inspectorSections.some((entry) => normalizeInspectorSectionKey(entry) === key);
}

export function resolveInspectorSectionVisibility(
  definition: Pick<WidgetDefinition, 'inspectorSections'>,
  key: InspectorSectionKey,
  node: WidgetNode,
  state: StudioState,
): boolean {
  const entry = definition.inspectorSections.find((candidate) => normalizeInspectorSectionKey(candidate) === key);
  if (!entry) return true;
  if (typeof entry === 'string') return true;
  return entry.visibleWhen(node, state);
}

export function getWidgetFieldPanelKey(definition: Pick<WidgetDefinition, 'inspectorFields' | 'renderInspector' | 'inspectorSections'>): WidgetInspectorPanelKey | null {
  if (definition.renderInspector || definition.inspectorFields?.length) return 'widget-fields';
  if (hasInspectorSection(definition, 'module-config')) return 'module-config';
  return null;
}

export function resolveInspectorTabs(definition: WidgetDefinition): WidgetInspectorTabSpec[] {
  if (definition.inspectorTabs?.length) return createInspectorTabs(definition.inspectorTabs);

  const fieldPanel = getWidgetFieldPanelKey(definition);
  const basicsPanels: WidgetInspectorPanelKey[] = ['position-size'];
  if (hasInspectorSection(definition, 'text-content')) basicsPanels.push('text-content');
  if (fieldPanel) basicsPanels.push(fieldPanel);
  if (hasInspectorSection(definition, 'fill')) basicsPanels.push('fill');
  if (hasInspectorSection(definition, 'shadow')) basicsPanels.push('shadow');
  if (hasInspectorSection(definition, 'timing')) basicsPanels.push('timing');

  const behaviorPanels: WidgetInspectorPanelKey[] = ['conditions', 'actions'];
  if (hasInspectorSection(definition, 'states')) behaviorPanels.push('states');
  behaviorPanels.push('keyframes');

  const dataPanels: WidgetInspectorPanelKey[] = [];
  if (hasInspectorSection(definition, 'data-bindings')) dataPanels.push('data-bindings');
  if (hasInspectorSection(definition, 'variants')) dataPanels.push('variants');

  const tabs: WidgetInspectorTabSpec[] = [
    { id: 'basics', label: 'Basics', panels: basicsPanels },
    { id: 'behavior', label: 'Behavior', panels: behaviorPanels },
  ];

  if (dataPanels.length) tabs.push({ id: 'data', label: 'Data', panels: dataPanels });
  return tabs;
}
