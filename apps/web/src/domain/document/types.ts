export type WidgetType =
  | 'text'
  | 'badge'
  | 'image'
  | 'hero-image'
  | 'video-hero'
  | 'image-carousel'
  | 'cta'
  | 'shape'
  | 'group'
  | 'countdown'
  | 'add-to-calendar'
  | 'shoppable-sidebar'
  | 'speed-test'
  | 'scratch-reveal'
  | 'form'
  | 'dynamic-map'
  | 'weather-conditions'
  | 'range-slider'
  | 'interactive-hotspot'
  | 'slider'
  | 'qr-code'
  | 'travel-deal'
  | 'interactive-gallery'
  | 'gen-ai-image'
  | 'buttons';

export type WidgetFrame = { x: number; y: number; width: number; height: number; rotation: number; };
export type KeyframeProperty = 'x' | 'y' | 'width' | 'height' | 'opacity';
export type KeyframeEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type KeyframeNode = { id: string; atMs: number; property: KeyframeProperty; value: number; easing?: KeyframeEasing; };
export type WidgetTimeline = { startMs: number; endMs: number; excluded?: boolean; keyframes?: KeyframeNode[]; };
export type ActionTrigger = 'click' | 'hover' | 'load' | 'timeline-enter';
export type ActionType = 'open-url' | 'show-widget' | 'hide-widget' | 'toggle-widget' | 'set-text' | 'go-to-scene';
export type ActionNode = { id: string; widgetId: string; trigger: ActionTrigger; type: ActionType; targetWidgetId?: string; targetSceneId?: string; url?: string; text?: string; label?: string; };
export type VariantName = 'default' | 'promo' | 'alternate';
export type BindingSource = 'product' | 'weather' | 'location' | 'custom';
export type WidgetBinding = { source: BindingSource; field: string; fallback?: string; };
export type VariantOverride = { props?: Record<string, unknown>; style?: Record<string, unknown>; };
export type FeedRecord = { id: string; label: string; values: Record<string, string> };
export type FeedCatalog = Record<BindingSource, FeedRecord[]>;
export type SceneTransitionType = 'cut' | 'fade' | 'slide-left' | 'slide-right';
export type SceneTransition = { type: SceneTransitionType; durationMs: number; };
export type RuleOperator = 'equals' | 'not-equals' | 'contains' | 'starts-with';
export type RuleCondition = { source: BindingSource; field: string; value: string; operator?: RuleOperator };
export type WidgetConditions = {
  variants?: VariantName[];
  records?: string[];
  equals?: RuleCondition;
};
export type SceneConditions = {
  variants?: VariantName[];
  records?: string[];
  equals?: RuleCondition;
};
export type SceneBranch = RuleCondition & { targetSceneId: string; label?: string };
export type CollaborationAnchor = { type: 'document' | 'scene' | 'widget'; targetId?: string };
export type CommentStatus = 'open' | 'resolved';
export type ApprovalStatus = 'pending' | 'approved' | 'changes-requested';
export type CommentNode = { id: string; author: string; message: string; createdAt: string; status: CommentStatus; anchor: CollaborationAnchor; };
export type ApprovalRequest = { id: string; label: string; requestedBy: string; requestedAt: string; status: ApprovalStatus; reviewer?: string; note?: string; };
export type CollaborationState = { comments: CommentNode[]; approvals: ApprovalRequest[]; shareLink?: string; };
export type SceneFlow = {
  nextSceneId?: string;
  branchEquals?: SceneBranch;
  branches?: SceneBranch[];
};
export type WidgetNode = { id: string; type: WidgetType; name: string; sceneId: string; zIndex: number; hidden?: boolean; locked?: boolean; parentId?: string; childIds?: string[]; frame: WidgetFrame; props: Record<string, unknown>; style: Record<string, unknown>; bindings?: Record<string, WidgetBinding>; variants?: Partial<Record<VariantName, VariantOverride>>; conditions?: WidgetConditions; timeline: WidgetTimeline; };
export type SceneNode = { id: string; name: string; order: number; widgetIds: string[]; durationMs: number; conditions?: SceneConditions; flow?: SceneFlow; transition?: SceneTransition; };
export type CanvasNode = { width: number; height: number; backgroundColor: string; presetId?: string; };
export type ReleaseTarget = 'generic-html5' | 'google-display' | 'gam-html5' | 'mraid' | 'meta-story' | 'tiktok-vertical';
export type QaStatus = 'draft' | 'ready-for-qa' | 'qa-passed';
export type ReleaseSettings = {
  targetChannel: ReleaseTarget;
  qaStatus: QaStatus;
  notes?: string;
};
export type ProjectPlatformMetadata = {
  clientId?: string;
  clientName?: string;
  brandId?: string;
  brandName?: string;
  campaignName?: string;
  accessScope?: import('../../types/contracts/access-scopes').ProjectAccessScope;
};
export type StudioDocument = { id: string; name: string; version: number; canvas: CanvasNode; scenes: SceneNode[]; widgets: Record<string, WidgetNode>; actions: Record<string, ActionNode>; feeds: FeedCatalog; collaboration: CollaborationState; selection: { widgetIds: string[]; activeSceneId: string; primaryWidgetId?: string }; metadata: { dirty: boolean; lastSavedAt?: string; lastAutosavedAt?: string; release: ReleaseSettings; platform?: ProjectPlatformMetadata; }; };
export type StudioState = { document: StudioDocument; ui: { zoom: number; playheadMs: number; isPlaying: boolean; previewMode: boolean; hoveredWidgetId?: string; activeWidgetId?: string; lastTriggeredActionLabel?: string; activeVariant: VariantName; activeFeedSource: BindingSource; activeFeedRecordId: string; activeProjectId?: string; activeLeftTab: 'widgets' | 'layers' | 'assets' | 'flow'; stageBackdrop: 'dark' | 'gray' | 'light'; showStageRulers: boolean; }; };
