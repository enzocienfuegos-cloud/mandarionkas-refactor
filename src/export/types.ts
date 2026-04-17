import type { ExportValidationIssue } from '../domain/document/export-validation';
import type { ReleaseTarget, SceneNode, WidgetType } from '../domain/document/types';

export type InteractionTier = 'banner-runtime' | 'advanced-interactive' | 'playable-runtime';

export type ExportInteractionPolicy = {
  tier: InteractionTier;
  responsiveMode: 'fixed' | 'adaptive' | 'fluid-policy';
  supportsScenes: boolean;
  supportsMultipleExits: boolean;
  supportsHotspots: boolean;
  supportsDrag: boolean;
  supportsSwipe: boolean;
  supportsPlayableState: boolean;
};

export type ExportCapabilityStatus = 'supported' | 'degraded' | 'unsupported';

export type ExportCapability = {
  widgetType: WidgetType;
  status: ExportCapabilityStatus;
  exportKind: 'dom' | 'media' | 'hotspot' | 'snapshot' | 'composition' | 'omit';
  minimumTier: InteractionTier;
  supportsMultipleExits: boolean;
  degradationStrategy?: 'snapshot' | 'static-dom' | 'flatten-to-image' | 'omit' | 'poster-fallback' | 'first-state';
  notes?: string[];
};

export type ResolvedWidgetCapability = ExportCapability & {
  widgetId: string;
  widgetName: string;
};

export type ExportCapabilitySummary = {
  selectedTier: InteractionTier;
  highestRequiredTier: InteractionTier;
  blockers: ResolvedWidgetCapability[];
  degraded: ResolvedWidgetCapability[];
  supported: ResolvedWidgetCapability[];
};

export type ExportQualityProfileName = 'high' | 'medium' | 'low';

export type ExportQualityProfile = {
  id: ExportQualityProfileName;
  label: string;
  description: string;
  imageHint: 'high' | 'medium' | 'low';
  videoHint: 'high' | 'medium' | 'low';
  posterHint: 'high' | 'medium' | 'low';
  svgHint: 'source';
};

export type ExportLinkedAsset = {
  id: string;
  src: string;
  publicUrl?: string;
  originUrl?: string;
  storageMode?: 'object-storage' | 'remote-url';
  storageKey?: string;
  mimeType?: string;
  posterSrc?: string;
};

export type ExportBuildOptions = {
  qualityProfile?: ExportQualityProfileName;
  linkedAssets?: ExportLinkedAsset[];
};

export type ExportAsset = {
  id: string;
  widgetId: string;
  kind: 'image' | 'video' | 'poster' | 'svg';
  src: string;
  source: 'data-url' | 'blob-url' | 'remote-url';
  linkedAssetId?: string;
  qualityHint: 'high' | 'medium' | 'low' | 'source';
  packagePath: string;
  packaging: 'bundled' | 'external-reference';
  mime?: string;
};

export type ExportExit = {
  id: string;
  label: string;
  sourceWidgetId: string;
  trigger: 'click' | 'tap';
  bounds: { x: number; y: number; width: number; height: number };
  url?: string;
  targetKey?: string;
  metadata?: Record<string, string>;
};

export type ExportSceneAction = {
  id: string;
  label: string;
  sourceWidgetId: string;
  trigger: 'click' | 'tap' | 'timeline-enter';
  targetSceneId: string;
  targetKey?: string;
  atMs?: number;
  bounds: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, string>;
};

export type ExportWidgetAction = {
  id: string;
  label: string;
  sourceWidgetId: string;
  targetWidgetId: string;
  trigger: 'click' | 'tap' | 'timeline-enter';
  actionType: 'show-widget' | 'hide-widget' | 'toggle-widget';
  targetKey?: string;
  atMs?: number;
  bounds: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, string>;
};

export type ExportTextAction = {
  id: string;
  label: string;
  sourceWidgetId: string;
  targetWidgetId: string;
  trigger: 'click' | 'tap' | 'timeline-enter';
  text: string;
  targetKey?: string;
  atMs?: number;
  bounds: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, string>;
};

export type ExportVisualStylePatch = {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  opacity?: number;
  boxShadow?: string;
};

export type ExportTargetVisualStates = Record<string, {
  base: ExportVisualStylePatch;
  hover?: ExportVisualStylePatch;
  active?: ExportVisualStylePatch;
}>;

export type ExportNode = {
  widgetId: string;
  widgetName: string;
  widgetType: WidgetType;
  sceneId: string;
  bounds: { x: number; y: number; width: number; height: number; rotation: number };
  zIndex: number;
  hidden: boolean;
  exportKind: ExportCapability['exportKind'];
  capabilityStatus: ExportCapabilityStatus;
  degradationStrategy?: ExportCapability['degradationStrategy'];
  capabilityNotes?: string[];
  assetIds: string[];
  exitIds: string[];
  visualStates: {
    base: ExportVisualStylePatch;
    hover?: ExportVisualStylePatch;
    active?: ExportVisualStylePatch;
  };
  targetVisualStates?: ExportTargetVisualStates;
};

export type ExportScene = {
  id: string;
  name: string;
  order: number;
  durationMs: number;
  transition?: SceneNode['transition'];
  nodeIds: string[];
};

export type ExportTargetCoverage = {
  widgetId: string;
  widgetName: string;
  widgetType: WidgetType;
  requiredTargets: string[];
  assignedTargets: string[];
  missingTargets: string[];
  coverage: 'full' | 'partial' | 'none';
};

export type ExportAssetSummary = {
  bundledCount: number;
  externalReferenceCount: number;
  dataUrlCount: number;
  remoteUrlCount: number;
  blobUrlCount: number;
};

export type ExportModel = {
  interactionTier: InteractionTier;
  highestRequiredTier: InteractionTier;
  qualityProfile: ExportQualityProfileName;
  initialSceneId?: string;
  scenes: ExportScene[];
  nodes: ExportNode[];
  exits: ExportExit[];
  sceneActions: ExportSceneAction[];
  widgetActions: ExportWidgetAction[];
  textActions: ExportTextAction[];
  assets: ExportAsset[];
  assetSummary: ExportAssetSummary;
  targetCoverage: ExportTargetCoverage[];
};

export type ExportPackageFile = {
  path: string;
  mime: string;
  content: string;
};

export type ExportPackageBundle = {
  entry: string;
  files: ExportPackageFile[];
};

export type ExportReadiness = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  blockers: number;
  warnings: number;
  checklist: Array<{ label: string; passed: boolean }>;
  targetChannel: ReleaseTarget;
  qaStatus: string;
  interactionTier: InteractionTier;
  highestRequiredTier: InteractionTier;
  qualityProfile: ExportQualityProfileName;
  capabilitySummary: ExportCapabilitySummary;
  targetCoverage: ExportTargetCoverage[];
  assetSummary: ExportAssetSummary;
  degradedWidgets: ResolvedWidgetCapability[];
  blockedWidgets: ResolvedWidgetCapability[];
};

export type ChannelRequirement = {
  id: string;
  label: string;
  passed: boolean;
  severity?: 'warning' | 'error';
};

export type ExportManifest = {
  documentId: string;
  documentName: string;
  exportedAt: string;
  canvas: { width: number; height: number; backgroundColor: string };
  activeVariant: string;
  activeFeedSource: string;
  activeFeedRecordId: string;
  sceneCount: number;
  widgetCount: number;
  actionCount: number;
  targetChannel: ReleaseTarget;
  qaStatus: string;
  interactionTier: InteractionTier;
  highestRequiredTier: InteractionTier;
  qualityProfile: ExportQualityProfileName;
  exitCount: number;
  assetCount: number;
  bundledAssetCount: number;
  externalAssetCount: number;
  blobAssetCount: number;
  degradedWidgetCount: number;
  blockedWidgetCount: number;
  partiallyCoveredTargetCount: number;
  uncoveredTargetCount: number;
  degradedWidgets: ResolvedWidgetCapability[];
  blockedWidgets: ResolvedWidgetCapability[];
  issues: ExportValidationIssue[];
  channelChecklist: ChannelRequirement[];
  exportModel: ExportModel;
};
