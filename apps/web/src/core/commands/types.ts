import type { ActionNode, ActionTrigger, ActionType, BindingSource, KeyframeEasing, KeyframeProperty, VariantName, WidgetBinding, WidgetNode, WidgetType } from '../../domain/document/types';

export type WidgetCreatePlacement = { x: number; y: number; anchor?: 'center' | 'top-left' };

export type StudioCommand =
  | { type: 'CREATE_WIDGET'; widgetType: WidgetType; placement?: WidgetCreatePlacement; initialProps?: Record<string, unknown>; initialStyle?: Record<string, unknown> }
  | { type: 'SELECT_WIDGET'; widgetId: string | null; additive?: boolean; range?: boolean }
  | { type: 'SELECT_WIDGETS'; widgetIds: string[]; primaryWidgetId?: string }
  | { type: 'UPDATE_DOCUMENT_NAME'; name: string }
  | { type: 'UPDATE_CANVAS_SIZE'; width: number; height: number }
  | { type: 'APPLY_CANVAS_PRESET'; presetId: string }
  | { type: 'UPDATE_CANVAS_BACKGROUND'; backgroundColor: string }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'UPDATE_WIDGET_NAME'; widgetId: string; name: string }
  | { type: 'UPDATE_WIDGET_FRAME'; widgetId: string; patch: Partial<WidgetNode['frame']> }
  | { type: 'UPDATE_WIDGET_FRAMES'; patches: Array<{ widgetId: string; patch: Partial<WidgetNode['frame']> }> }
  | { type: 'UPDATE_WIDGET_PROPS'; widgetId: string; patch: Record<string, unknown> }
  | { type: 'UPDATE_WIDGET_STYLE'; widgetId: string; patch: Record<string, unknown> }
  | { type: 'DELETE_SELECTED_WIDGETS' }
  | { type: 'DUPLICATE_SELECTED_WIDGETS' }
  | { type: 'GROUP_SELECTED_WIDGETS' }
  | { type: 'UNGROUP_SELECTED_WIDGETS' }
  | { type: 'TOGGLE_WIDGET_HIDDEN'; widgetId: string }
  | { type: 'TOGGLE_WIDGET_LOCKED'; widgetId: string }
  | { type: 'REORDER_WIDGET'; widgetId: string; direction: 'forward' | 'backward' | 'front' | 'back' }
  | { type: 'UPDATE_WIDGET_TIMING'; widgetId: string; patch: Partial<WidgetNode['timeline']> }
  | { type: 'SET_PLAYHEAD'; playheadMs: number }
  | { type: 'SET_PLAYING'; isPlaying: boolean }
  | { type: 'SET_PREVIEW_MODE'; previewMode: boolean }
  | { type: 'SET_LEFT_TAB'; tab: import('../../domain/document/types').StudioState['ui']['activeLeftTab'] }
  | { type: 'SET_STAGE_BACKDROP'; stageBackdrop: import('../../domain/document/types').StudioState['ui']['stageBackdrop'] }
  | { type: 'SET_STAGE_RULERS'; enabled: boolean }
  | { type: 'SET_ACTIVE_VARIANT'; variant: VariantName }
  | { type: 'SET_ACTIVE_FEED_SOURCE'; source: BindingSource }
  | { type: 'SET_ACTIVE_FEED_RECORD'; recordId: string }
  | { type: 'UPSERT_FEED_RECORD'; source: BindingSource; record: import('../../domain/document/types').FeedRecord }
  | { type: 'DELETE_FEED_RECORD'; source: BindingSource; recordId: string }
  | { type: 'ADD_SCENE' }
  | { type: 'SELECT_SCENE'; sceneId: string }
  | { type: 'DUPLICATE_SCENE'; sceneId: string }
  | { type: 'DELETE_SCENE'; sceneId: string }
  | { type: 'UPDATE_SCENE'; sceneId: string; patch: Partial<import('../../domain/document/types').SceneNode> }
  | { type: 'GO_TO_NEXT_SCENE' }
  | { type: 'GO_TO_PREVIOUS_SCENE' }
  | { type: 'UPDATE_WIDGET_BINDING'; widgetId: string; key: string; binding?: WidgetBinding }
  | { type: 'UPDATE_WIDGET_VARIANT'; widgetId: string; variant: Exclude<VariantName, 'default'>; area: 'props' | 'style'; patch: Record<string, unknown> }
  | { type: 'UPDATE_WIDGET_CONDITIONS'; widgetId: string; patch: Partial<import('../../domain/document/types').WidgetConditions> }
  | { type: 'SET_HOVERED_WIDGET'; widgetId?: string }
  | { type: 'SET_ACTIVE_WIDGET'; widgetId?: string }
  | { type: 'ADD_KEYFRAME'; widgetId: string; property: KeyframeProperty; atMs: number }
  | { type: 'REMOVE_KEYFRAME'; widgetId: string; keyframeId: string }
  | { type: 'UPDATE_KEYFRAME'; widgetId: string; keyframeId: string; patch: { atMs?: number; value?: number; easing?: KeyframeEasing } }
  | { type: 'ADD_WIDGET_ACTION'; widgetId: string; trigger?: ActionTrigger; actionType?: ActionType }
  | { type: 'UPDATE_WIDGET_ACTION'; actionId: string; patch: Partial<ActionNode> }
  | { type: 'REMOVE_WIDGET_ACTION'; actionId: string }
  | { type: 'EXECUTE_ACTION'; actionId: string }
  | { type: 'MARK_DOCUMENT_AUTOSAVED'; at: string }
  | { type: 'ADD_COMMENT'; anchor: import('../../domain/document/types').CollaborationAnchor; message: string; author?: string }
  | { type: 'UPDATE_COMMENT_STATUS'; commentId: string; status: import('../../domain/document/types').CommentStatus }
  | { type: 'DELETE_COMMENT'; commentId: string }
  | { type: 'ADD_APPROVAL_REQUEST'; label: string; requestedBy?: string }
  | { type: 'UPDATE_APPROVAL_STATUS'; approvalId: string; status: import('../../domain/document/types').ApprovalStatus; reviewer?: string; note?: string }
  | { type: 'SET_SHARE_LINK'; shareLink: string }
  | { type: 'UPDATE_RELEASE_SETTINGS'; patch: Partial<import('../../domain/document/types').ReleaseSettings> }
  | { type: 'UPDATE_DOCUMENT_PLATFORM_METADATA'; patch: Partial<import('../../domain/document/types').ProjectPlatformMetadata> }
  | { type: 'MARK_DOCUMENT_SAVED'; at: string }
  | { type: 'UNDO' }
  | { type: 'REDO' };
