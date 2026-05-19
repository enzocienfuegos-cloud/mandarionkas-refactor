import { createInitialState } from './factories';
import { createCanvasVariantFromCanvas, ensureSingleMasterVariant, syncDocumentCanvasToVariant } from './canvas-variants';
import type { FeedCatalog, MotionSlot, StudioState, WidgetHoverMotion, WidgetMotion, WidgetNode } from './types';
import { buildWidgetHoverMotion, buildWidgetMotion, cloneWidgetMotion } from '../../motion/motion-model';
import { widgetSupportsMotion } from '../../motion/motion-widget-compatibility';
import { rebuildWidgetMotionKeyframes } from '../../motion/motion-template-keyframes';
import { stripMotionManagedKeyframes } from '../../motion/motion-managed-keyframes';

function isLegacyMotionShape(motion: unknown): motion is { templateId: string | null; config: Record<string, number | string> } {
  return Boolean(
    motion
      && typeof motion === 'object'
      && 'templateId' in motion
      && !('enter' in motion)
      && !('idle' in motion)
      && !('exit' in motion),
  );
}

function cloneMotionSlot(slot: MotionSlot | undefined): MotionSlot | undefined {
  return slot ? { ...slot, config: { ...slot.config } } : undefined;
}

function migrateLegacyExcludedFlag(
  widgets: Record<string, WidgetNode> | undefined,
  sceneDurationByIdMap: Map<string, number>,
): Record<string, WidgetNode> {
  if (!widgets) return {};
  return Object.fromEntries(
    Object.entries(widgets).map(([widgetId, widget]) => {
      const legacyTimeline = widget.timeline as WidgetNode['timeline'] & { excluded?: boolean };
      if (!legacyTimeline.excluded) return [widgetId, widget];
      const sceneDurationMs = sceneDurationByIdMap.get(widget.sceneId) ?? widget.timeline.endMs;
      return [
        widgetId,
        {
          ...widget,
          timeline: {
            startMs: 0,
            endMs: Math.max(widget.timeline.endMs, sceneDurationMs),
            keyframes: widget.timeline.keyframes ?? [],
          },
        },
      ];
    }),
  );
}

function normalizeFeeds(feeds: StudioState['document']['feeds'] | undefined): FeedCatalog {
  const defaults = createInitialState().document.feeds;
  return {
    product: feeds?.product ?? defaults.product,
    weather: feeds?.weather ?? defaults.weather,
    location: feeds?.location ?? defaults.location,
    custom: feeds?.custom ?? defaults.custom,
  };
}

function resolveNormalizedMotion(widget: WidgetNode): WidgetMotion | undefined {
  if (!widgetSupportsMotion(widget)) return undefined;
  if (isLegacyMotionShape(widget.motion)) {
    return buildWidgetMotion(widget.motion.templateId, widget.motion.config, { trigger: 'timeline' });
  }
  if (widget.motion?.enter || widget.motion?.idle || widget.motion?.exit) {
    return {
      enter: cloneMotionSlot(widget.motion.enter),
      idle: cloneMotionSlot(widget.motion.idle),
      exit: cloneMotionSlot(widget.motion.exit),
    };
  }
  const templateId = typeof widget.style.animationPreset === 'string' ? widget.style.animationPreset : '';
  if (!templateId) return undefined;
  return buildWidgetMotion(templateId, {
    durationMs: Number(widget.style.animationDurationMs ?? undefined),
    delayMs: Number(widget.style.animationDelayMs ?? undefined),
    distancePx: Number(widget.style.animationDistancePx ?? undefined),
    intensity: Number(widget.style.animationIntensity ?? undefined),
    repeatMode: String(widget.style.animationRepeatMode ?? 'once'),
  }, { trigger: 'timeline' });
}

function resolveNormalizedHoverMotion(widget: WidgetNode): WidgetHoverMotion | undefined {
  if (widget.hoverMotion?.templateId) {
    return buildWidgetHoverMotion(widget.hoverMotion.templateId, widget.hoverMotion.config);
  }
  const templateId = typeof widget.style.hoverMotionPreset === 'string' ? widget.style.hoverMotionPreset : '';
  if (!templateId || templateId === 'none') return undefined;
  return buildWidgetHoverMotion(templateId, {
    durationMs: Number(widget.style.hoverMotionDurationMs ?? undefined),
    distancePx: Number(widget.style.hoverMotionDistancePx ?? undefined),
    scale: Number(widget.style.hoverMotionScale ?? undefined),
  });
}

function normalizeWidgets(widgets: StudioState['document']['widgets'] | undefined): StudioState['document']['widgets'] {
  if (!widgets) return {};
  return Object.fromEntries(
    Object.entries(widgets).map(([widgetId, widget]) => {
      const nextProps = { ...widget.props };
      if (widget.type === 'drag-token-pool') {
        if (typeof nextProps.tokens === 'string') {
          try {
            const parsed = JSON.parse(nextProps.tokens);
            nextProps.tokens = Array.isArray(parsed) ? parsed : [];
          } catch {
            nextProps.tokens = [];
          }
        } else if (!Array.isArray(nextProps.tokens)) {
          nextProps.tokens = [];
        }
        if (typeof nextProps.disabledIds === 'string') {
          nextProps.disabledIds = nextProps.disabledIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        } else if (!Array.isArray(nextProps.disabledIds)) {
          nextProps.disabledIds = [];
        }
      }
      const motion = resolveNormalizedMotion(widget);
      return [
        widgetId,
        {
          ...widget,
          props: nextProps,
          motion: cloneWidgetMotion(motion),
          hoverMotion: resolveNormalizedHoverMotion(widget),
          timeline: {
            ...widget.timeline,
            keyframes: motion
              ? rebuildWidgetMotionKeyframes(widget, motion, widget.timeline.keyframes ?? [])
              : stripMotionManagedKeyframes(widget.timeline.keyframes ?? []),
          },
        },
      ];
    }),
  );
}

// ---------------------------------------------------------------------------
// Font-family alias migration
// Builds the set of legacy font-family names that were generated by the old
// multi-alias scheme (removed in S57). Kept here as a private helper so the
// migration can rewrite widgets without importing the deleted export.
// ---------------------------------------------------------------------------

function legacyFontFamilyNamesForId(safeBase: string, assetId: string): Set<string> {
  const safeId = assetId.replace(/[^a-zA-Z0-9]+/g, '');
  const aliases = new Set<string>();
  const legacyPrefix = safeId.slice(0, 6);
  if (legacyPrefix) aliases.add(`SMX_${safeBase}_${legacyPrefix}`);
  aliases.add(`SMX_${safeBase}_asset-`);
  aliases.add(`SMX_${safeBase}`);
  return aliases;
}

function canonicalFontFamilyNameFromParts(safeBase: string, assetId: string): string {
  const safeId = assetId.replace(/[^a-zA-Z0-9]+/g, '');
  const suffix = safeId.slice(-8) || safeId || 'font';
  return `SMX_${safeBase}_${suffix}`;
}

/**
 * Rewrites any `widget.style.fontFamily` values that match a legacy alias
 * (generated by the old `resolveFontAssetFamilyAliases` scheme) to the
 * canonical name produced by `resolveFontAssetFamily`.
 */
function migrateFontFamilyAliases(raw: StudioState): StudioState {
  const widgets = raw.document.widgets;
  const entries = Object.entries(widgets);
  let changed = false;

  const nextWidgets = Object.fromEntries(
    entries.map(([widgetId, widget]) => {
      const assetId = typeof widget.props.fontAssetId === 'string' ? widget.props.fontAssetId.trim() : '';
      const fontFamily = typeof widget.style.fontFamily === 'string' ? widget.style.fontFamily.trim() : '';
      if (!assetId || !fontFamily) return [widgetId, widget];

      // Extract safeBase from the current fontFamily. Canonical and all legacy
      // names follow the pattern SMX_<safeBase>_... so we can derive safeBase
      // by stripping the known suffix from a matched legacy alias pattern.
      // Alternatively, compute canonical and check if current value differs.
      const safeId = assetId.replace(/[^a-zA-Z0-9]+/g, '');
      const canonicalSuffix = safeId.slice(-8) || safeId || 'font';

      // Try to extract safeBase by matching the SMX_ prefix pattern
      const smxPrefixMatch = /^SMX_(.+)_[^_]+$/.exec(fontFamily) ?? /^SMX_(.+)$/.exec(fontFamily);
      if (!smxPrefixMatch) return [widgetId, widget];

      // The captured group between SMX_ and the last _segment is safeBase.
      // For patterns with no trailing segment (SMX_<safeBase>), use full remainder.
      const candidateSafeBase = smxPrefixMatch[1];
      if (!candidateSafeBase) return [widgetId, widget];

      const canonical = canonicalFontFamilyNameFromParts(candidateSafeBase, assetId);

      // If it's already canonical, nothing to do.
      if (fontFamily === canonical) return [widgetId, widget];

      // If the current value is a known legacy alias, replace it.
      const legacyAliases = legacyFontFamilyNamesForId(candidateSafeBase, assetId);
      if (!legacyAliases.has(fontFamily)) return [widgetId, widget];

      changed = true;
      return [
        widgetId,
        {
          ...widget,
          style: { ...widget.style, fontFamily: canonical },
        },
      ];
    }),
  );

  if (!changed) return raw;
  return {
    ...raw,
    document: { ...raw.document, widgets: nextWidgets },
  };
}

export function normalizeStudioState(raw: StudioState): StudioState {
  const base = createInitialState();
  const rawLeftTab = raw.ui?.activeLeftTab as string | undefined;
  const normalizedLeftTab = rawLeftTab === 'assets'
    ? 'widgets'
    : ((rawLeftTab as StudioState['ui']['activeLeftTab'] | undefined) ?? base.ui.activeLeftTab);
  const activeSceneId = raw.document.selection?.activeSceneId && raw.document.scenes.some((scene) => scene.id === raw.document.selection.activeSceneId)
    ? raw.document.selection.activeSceneId
    : raw.document.scenes[0]?.id ?? base.document.selection.activeSceneId;
  const rawVariants = raw.document.canvasVariants?.length
    ? raw.document.canvasVariants
    : [createCanvasVariantFromCanvas(raw.document.canvas ?? base.document.canvas, {
        label: `${(raw.document.canvas ?? base.document.canvas).width}×${(raw.document.canvas ?? base.document.canvas).height}`,
        isMaster: true,
      })];
  const canvasVariants = ensureSingleMasterVariant(
    rawVariants.map((variant) => ({
      ...variant,
      presetId: variant.presetId ?? base.document.canvas.presetId ?? 'custom',
      backgroundColor: variant.backgroundColor ?? raw.document.canvas?.backgroundColor ?? base.document.canvas.backgroundColor,
      label: variant.label || `${variant.width}×${variant.height}`,
    })),
    raw.document.activeCanvasVariantId,
  );
  const activeCanvasVariantId = canvasVariants.some((variant) => variant.id === raw.document.activeCanvasVariantId)
    ? raw.document.activeCanvasVariantId
    : canvasVariants[0]?.id ?? base.document.activeCanvasVariantId;
  const sceneDurationByIdMap = new Map((raw.document.scenes ?? []).map((scene) => [scene.id, scene.durationMs]));
  const fontMigrated = migrateFontFamilyAliases(raw);
  const migratedWidgets = migrateLegacyExcludedFlag(fontMigrated.document.widgets, sceneDurationByIdMap);

  const normalized: StudioState = {
    document: {
      ...base.document,
      ...raw.document,
      canvasVariants,
      activeCanvasVariantId,
      widgetOverrides: raw.document.widgetOverrides ?? {},
      widgets: normalizeWidgets(migratedWidgets),
      sharedLayers: raw.document.sharedLayers ?? {},
      feeds: normalizeFeeds(raw.document.feeds),
      selection: {
        widgetIds: raw.document.selection?.widgetIds ?? [],
        primaryWidgetId: raw.document.selection?.primaryWidgetId,
        activeSceneId,
      },
      metadata: {
        dirty: raw.document.metadata?.dirty ?? false,
        lastSavedAt: raw.document.metadata?.lastSavedAt,
        lastAutosavedAt: raw.document.metadata?.lastAutosavedAt,
        release: {
          ...base.document.metadata.release,
          ...(raw.document.metadata?.release ?? {}),
        },
        platform: {
          ...base.document.metadata.platform,
          ...(raw.document.metadata?.platform ?? {}),
        },
      },
    },
    ui: {
      ...base.ui,
      ...raw.ui,
      isPlaying: false,
      previewMode: false,
      previewContext: raw.ui?.previewContext ?? base.ui.previewContext,
      hoveredWidgetId: undefined,
      activeWidgetId: undefined,
      activeLeftTab: normalizedLeftTab,
      stageBackdrop: raw.ui?.stageBackdrop ?? base.ui.stageBackdrop,
      showStageRulers: raw.ui?.showStageRulers ?? base.ui.showStageRulers,
      showWidgetBadges: raw.ui?.showWidgetBadges ?? base.ui.showWidgetBadges,
    },
  };

  return {
    ...normalized,
    document: syncDocumentCanvasToVariant(normalized.document),
  };
}
