import { getWidgetActionTargetOptions, getWidgetActionTargetRect } from '../domain/document/action-targets';
import { resolveNextSceneId, sceneMatchesConditions, resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { ActionNode, StudioState, WidgetNode } from '../domain/document/types';
import { canUseBrowserStorage, readStorageItem } from '../shared/browser/storage';
import { resolveExportCapabilities } from './capabilities';
import { resolveAssetQualityHint } from './quality-profile';
import type { ExportAsset, ExportBuildOptions, ExportExit, ExportModel, ExportNode, ExportScene, ExportSceneAction, ExportTargetCoverage, ExportWidgetAction, ExportTextAction, ExportVisualStylePatch, ExportTargetVisualStates } from './types';

const ASSET_LIBRARY_KEY = 'smx-studio-v4:asset-library';
const ASSET_OBJECT_STORE_KEY = 'smx-studio-v4:asset-object-store';

type StoredAssetRecord = {
  id: string;
  src: string;
  publicUrl?: string;
  originUrl?: string;
  storageMode?: 'object-storage' | 'remote-url';
  storageKey?: string;
  mimeType?: string;
  posterSrc?: string;
};

function buildQrPattern(url: string): boolean[] {
  const seed = (url || 'dusk').split('').reduce((acc, value) => acc + value.charCodeAt(0), 0);
  return Array.from({ length: 81 }, (_, index) => ((seed + index * 17 + Math.floor(index / 9) * 13) % 5) < 2);
}

function buildQrSvgDataUrl(url: string, accent = '#111827'): string {
  const pattern = buildQrPattern(url);
  const cellSize = 12;
  const padding = 10;
  const size = padding * 2 + cellSize * 9;
  const cells = pattern
    .map((filled, index) => {
      if (!filled) return '';
      const x = padding + (index % 9) * cellSize;
      const y = padding + Math.floor(index / 9) * cellSize;
      return `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${accent}" />`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code"><rect width="${size}" height="${size}" rx="16" fill="#ffffff" />${cells}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createAssetId(widgetId: string, suffix: string): string {
  return `${widgetId}:${suffix}`;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'asset';
}

function extensionForAsset(kind: ExportAsset['kind'], src: string): string {
  if (src.startsWith('data:image/svg+xml')) return 'svg';
  if (src.startsWith('data:image/png')) return 'png';
  if (src.startsWith('data:image/jpeg')) return 'jpg';
  if (src.startsWith('data:image/webp')) return 'webp';
  if (src.startsWith('data:video/mp4')) return 'mp4';
  try {
    const pathname = new URL(src).pathname;
    const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
    if (match) return match[1].toLowerCase();
  } catch {
    const match = src.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    if (match) return match[1].toLowerCase();
  }
  switch (kind) {
    case 'svg':
      return 'svg';
    case 'video':
      return 'mp4';
    case 'poster':
    case 'image':
    default:
      return 'png';
  }
}

function mimeForAsset(kind: ExportAsset['kind'], src: string): string {
  const extension = extensionForAsset(kind, src);
  switch (extension) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    default:
      return kind === 'video' ? 'video/mp4' : 'application/octet-stream';
  }
}

function packagingForSrc(src: string): ExportAsset['packaging'] {
  return src.startsWith('data:') ? 'bundled' : 'external-reference';
}

function packagePathForAsset(widgetId: string, kind: ExportAsset['kind'], src: string): string {
  const extension = extensionForAsset(kind, src);
  return `assets/${sanitizePathSegment(widgetId)}-${kind}.${extension}`;
}

function readStoredAssetLibrary(): StoredAssetRecord[] {
  if (!canUseBrowserStorage()) return [];
  const raw = readStorageItem(ASSET_LIBRARY_KEY, '');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredAssetRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredAssetObjectStore(): Record<string, string> {
  if (!canUseBrowserStorage()) return {};
  const raw = readStorageItem(ASSET_OBJECT_STORE_KEY, '');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveLinkedAsset(linkedAssetId?: string): StoredAssetRecord | undefined {
  if (!linkedAssetId) return undefined;
  return readStoredAssetLibrary().find((asset) => asset.id === linkedAssetId);
}

function chooseLinkedAssetCandidate(
  linkedAsset: StoredAssetRecord,
  explicitSrc: string,
  qualityProfile: ExportBuildOptions['qualityProfile'] = 'medium',
): { src: string; mime?: string } {
  const objectStore = readStoredAssetObjectStore();
  const payload = linkedAsset.storageMode === 'object-storage' && linkedAsset.storageKey
    ? objectStore[linkedAsset.storageKey]
    : undefined;
  const highCandidates = [payload, linkedAsset.publicUrl, linkedAsset.src, explicitSrc];
  const balancedCandidates = [linkedAsset.publicUrl, payload, linkedAsset.src, explicitSrc];
  const qualityCandidates = qualityProfile === 'high' ? highCandidates : balancedCandidates;
  const chosen = qualityCandidates.find((candidate) => Boolean(candidate && candidate.trim()));
  return {
    src: chosen?.trim() || explicitSrc,
    mime: linkedAsset.mimeType,
  };
}

function resolveLinkedAssetSrc(linkedAssetId: string | undefined, explicitSrc: string, options: ExportBuildOptions = {}): { src: string; mime?: string } {
  const linkedAsset = resolveLinkedAsset(linkedAssetId);
  if (!linkedAsset) return { src: explicitSrc };
  return chooseLinkedAssetCandidate(linkedAsset, explicitSrc, options.qualityProfile);
}

function sourceForSrc(src: string): ExportAsset['source'] {
  if (src.startsWith('data:')) return 'data-url';
  if (src.startsWith('blob:')) return 'blob-url';
  return 'remote-url';
}

function assetFromWidget(widget: WidgetNode, options: ExportBuildOptions = {}): ExportAsset[] {
  const qualityProfile = options.qualityProfile ?? 'medium';
  const assets: ExportAsset[] = [];
  if (widget.type === 'image' || widget.type === 'hero-image') {
    const linkedAssetId = String(widget.props.assetId ?? '').trim() || undefined;
    const resolved = resolveLinkedAssetSrc(linkedAssetId, String(widget.props.src ?? '').trim(), options);
    const src = resolved.src.trim();
    if (src) {
      const kind: ExportAsset['kind'] = 'image';
      assets.push({
        id: createAssetId(widget.id, 'image'),
        widgetId: widget.id,
        kind,
        src,
        source: sourceForSrc(src),
        linkedAssetId,
        qualityHint: resolveAssetQualityHint(kind, qualityProfile),
        packagePath: packagePathForAsset(widget.id, kind, src),
        packaging: packagingForSrc(src),
        mime: resolved.mime ?? mimeForAsset(kind, src),
      });
    }
  }
  if (widget.type === 'video-hero') {
    const linkedAssetId = String(widget.props.assetId ?? '').trim() || undefined;
    const resolvedVideo = resolveLinkedAssetSrc(linkedAssetId, String(widget.props.src ?? '').trim(), options);
    const resolvedPoster = resolveLinkedAssetSrc(linkedAssetId, String(widget.props.posterSrc ?? '').trim(), options);
    const src = resolvedVideo.src.trim();
    const posterSrc = resolvedPoster.src.trim();
    if (src) {
      const kind: ExportAsset['kind'] = 'video';
      assets.push({
        id: createAssetId(widget.id, 'video'),
        widgetId: widget.id,
        kind,
        src,
        source: sourceForSrc(src),
        linkedAssetId,
        qualityHint: resolveAssetQualityHint(kind, qualityProfile),
        packagePath: packagePathForAsset(widget.id, kind, src),
        packaging: packagingForSrc(src),
        mime: resolvedVideo.mime ?? mimeForAsset(kind, src),
      });
    }
    if (posterSrc) {
      const kind: ExportAsset['kind'] = 'poster';
      assets.push({
        id: createAssetId(widget.id, 'poster'),
        widgetId: widget.id,
        kind,
        src: posterSrc,
        source: sourceForSrc(posterSrc),
        linkedAssetId,
        qualityHint: resolveAssetQualityHint(kind, qualityProfile),
        packagePath: packagePathForAsset(widget.id, kind, posterSrc),
        packaging: packagingForSrc(posterSrc),
        mime: resolvedPoster.mime ?? mimeForAsset(kind, posterSrc),
      });
    }
  }
  if (widget.type === 'image-carousel') {
    const slides = String(widget.props.slides ?? '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [src, caption] = item.split('|');
        return { src: (src ?? '').trim(), caption: (caption ?? '').trim() };
      })
      .filter((item) => item.src);
    slides.forEach((slide, index) => {
      const kind: ExportAsset['kind'] = 'image';
      assets.push({
        id: createAssetId(widget.id, `slide-${index + 1}`),
        widgetId: widget.id,
        kind,
        src: slide.src,
        source: sourceForSrc(slide.src),
        qualityHint: resolveAssetQualityHint(kind, qualityProfile),
        packagePath: packagePathForAsset(`${widget.id}-slide-${index + 1}`, kind, slide.src),
        packaging: packagingForSrc(slide.src),
        mime: mimeForAsset(kind, slide.src),
      });
    });
  }
  if (widget.type === 'qr-code') {
    const qrUrl = String(widget.props.url ?? 'https://example.com');
    const src = buildQrSvgDataUrl(qrUrl, String(widget.style.accentColor ?? '#111827'));
    const kind: ExportAsset['kind'] = 'svg';
    assets.push({
      id: createAssetId(widget.id, 'qr'),
      widgetId: widget.id,
      kind,
      src,
      source: sourceForSrc(src),
      qualityHint: resolveAssetQualityHint(kind, qualityProfile),
      packagePath: packagePathForAsset(widget.id, kind, src),
      packaging: packagingForSrc(src),
      mime: mimeForAsset(kind, src),
    });
  }
  return assets;
}

function getWidgetTargetKeys(widget: WidgetNode): string[] {
  return getWidgetActionTargetOptions(widget).map((item) => item.value);
}

function exitsFromActions(widget: WidgetNode, actions: ActionNode[]): ExportExit[] {
  const resolveBounds = (targetKey?: string) => {
    return getWidgetActionTargetRect(widget, targetKey ?? 'whole-widget');
  };

  const exits = actions
    .filter((action) => action.type === 'open-url' && action.url)
    .map((action, index) => ({
      id: action.id,
      label: String(
        action.label
        ?? (action.targetKey === 'primary-button' ? widget.props.primaryLabel : undefined)
        ?? (action.targetKey === 'secondary-button' ? widget.props.secondaryLabel : undefined)
        ?? widget.props.text
        ?? widget.props.title
        ?? widget.name
        ?? `Exit ${index + 1}`,
      ),
      sourceWidgetId: widget.id,
      trigger: action.trigger === 'click' ? 'click' : 'tap',
      bounds: resolveBounds(action.targetKey),
      url: action.url,
      targetKey: action.targetKey ?? (index === 0 ? 'primary' : `action-${index + 1}`),
      metadata: {
        widgetType: widget.type,
        trigger: action.trigger,
      },
    }));

  if (!exits.length && widget.type === 'buttons') {
    return [
      {
        id: `${widget.id}:buttons-primary-fallback`,
        label: String(widget.props.primaryLabel ?? widget.props.title ?? widget.name ?? 'Primary button'),
        sourceWidgetId: widget.id,
        trigger: 'tap',
        targetKey: 'primary-button',
        bounds: resolveBounds('primary-button'),
        metadata: {
          widgetType: widget.type,
          fallback: 'true',
          note: 'Buttons widget has multiple visual targets but current action model is widget-level.',
        },
      },
    ];
  }

  return exits;
}

function coverageFromWidget(widget: WidgetNode, exits: ExportExit[]): ExportTargetCoverage | null {
  const requiredTargets = getWidgetTargetKeys(widget);
  if (!requiredTargets.length) return null;

  const assignedTargets = Array.from(new Set(
    exits
      .map((exit) => exit.targetKey)
      .filter((targetKey): targetKey is string => Boolean(targetKey && requiredTargets.includes(targetKey))),
  ));
  const missingTargets = requiredTargets.filter((target) => !assignedTargets.includes(target));
  const coverage: ExportTargetCoverage['coverage'] = assignedTargets.length === 0
    ? 'none'
    : missingTargets.length > 0
      ? 'partial'
      : 'full';

  return {
    widgetId: widget.id,
    widgetName: widget.name,
    widgetType: widget.type,
    requiredTargets,
    assignedTargets,
    missingTargets,
    coverage,
  };
}

function sceneActionsFromActions(widget: WidgetNode, actions: ActionNode[], state: StudioState): ExportSceneAction[] {
  return actions
    .filter((action) => action.type === 'go-to-scene')
    .map((action, index) => {
      const targetSceneId = action.targetSceneId || resolveNextSceneId(state, widget.sceneId);
      if (!targetSceneId) return null;
      return {
        id: action.id,
        label: String(
          action.label
          ?? (action.targetKey === 'primary-button' ? widget.props.primaryLabel : undefined)
          ?? (action.targetKey === 'secondary-button' ? widget.props.secondaryLabel : undefined)
          ?? widget.props.text
          ?? widget.props.title
          ?? widget.name
          ?? `Scene action ${index + 1}`,
        ),
        sourceWidgetId: widget.id,
        trigger: action.trigger === 'timeline-enter' ? 'timeline-enter' : action.trigger === 'click' ? 'click' : 'tap',
        targetSceneId,
        targetKey: action.targetKey,
        atMs: action.trigger === 'timeline-enter' ? widget.timeline.startMs : undefined,
        bounds: getWidgetActionTargetRect(widget, action.targetKey ?? 'whole-widget'),
        metadata: {
          widgetType: widget.type,
          trigger: action.trigger,
        },
      } satisfies ExportSceneAction;
    })
    .filter((action): action is ExportSceneAction => Boolean(action));
}

function widgetActionsFromActions(widget: WidgetNode, actions: ActionNode[], state: StudioState): ExportWidgetAction[] {
  return actions
    .filter((action) => (action.type === 'show-widget' || action.type === 'hide-widget' || action.type === 'toggle-widget') && action.targetWidgetId && state.document.widgets[action.targetWidgetId])
    .map((action, index) => ({
      id: action.id,
      label: String(
        action.label
        ?? (action.targetKey === 'primary-button' ? widget.props.primaryLabel : undefined)
        ?? (action.targetKey === 'secondary-button' ? widget.props.secondaryLabel : undefined)
        ?? widget.props.text
        ?? widget.props.title
        ?? widget.name
        ?? `Widget action ${index + 1}`,
      ),
      sourceWidgetId: widget.id,
      targetWidgetId: action.targetWidgetId as string,
      trigger: action.trigger === 'timeline-enter' ? 'timeline-enter' : action.trigger === 'click' ? 'click' : 'tap',
      actionType: action.type,
      targetKey: action.targetKey,
      atMs: action.trigger === 'timeline-enter' ? widget.timeline.startMs : undefined,
      bounds: getWidgetActionTargetRect(widget, action.targetKey ?? 'whole-widget'),
      metadata: {
        widgetType: widget.type,
        trigger: action.trigger,
      },
    }));
}

function textActionsFromActions(widget: WidgetNode, actions: ActionNode[], state: StudioState): ExportTextAction[] {
  return actions
    .filter((action) => action.type === 'set-text' && action.targetWidgetId && state.document.widgets[action.targetWidgetId] && action.text)
    .map((action, index) => ({
      id: action.id,
      label: String(
        action.label
        ?? (action.targetKey === 'primary-button' ? widget.props.primaryLabel : undefined)
        ?? (action.targetKey === 'secondary-button' ? widget.props.secondaryLabel : undefined)
        ?? widget.props.text
        ?? widget.props.title
        ?? widget.name
        ?? `Text action ${index + 1}`,
      ),
      sourceWidgetId: widget.id,
      targetWidgetId: action.targetWidgetId as string,
      trigger: action.trigger === 'timeline-enter' ? 'timeline-enter' : action.trigger === 'click' ? 'click' : 'tap',
      text: String(action.text ?? ''),
      targetKey: action.targetKey,
      atMs: action.trigger === 'timeline-enter' ? widget.timeline.startMs : undefined,
      bounds: getWidgetActionTargetRect(widget, action.targetKey ?? 'whole-widget'),
      metadata: {
        widgetType: widget.type,
        trigger: action.trigger,
      },
    }));
}

function buildVisualStylePatch(style: WidgetNode['style'], state: 'base' | 'hover' | 'active'): ExportVisualStylePatch {
  if (state === 'base') {
    return {
      backgroundColor: style.backgroundColor ? String(style.backgroundColor) : undefined,
      color: style.color ? String(style.color) : undefined,
      borderColor: style.borderColor ? String(style.borderColor) : undefined,
      opacity: style.opacity != null ? Number(style.opacity) : undefined,
      boxShadow: style.boxShadow ? String(style.boxShadow) : undefined,
    };
  }

  const prefix = state === 'hover' ? 'hover' : 'active';
  return {
    backgroundColor: style[`${prefix}BackgroundColor`] ? String(style[`${prefix}BackgroundColor`]) : undefined,
    color: style[`${prefix}Color`] ? String(style[`${prefix}Color`]) : undefined,
    borderColor: style[`${prefix}BorderColor`] ? String(style[`${prefix}BorderColor`]) : undefined,
    opacity: style[`${prefix}Opacity`] != null ? Number(style[`${prefix}Opacity`]) : undefined,
    boxShadow: style[`${prefix}Shadow`] ? String(style[`${prefix}Shadow`]) : undefined,
  };
}

function buildVisualStates(widget: WidgetNode): ExportNode['visualStates'] {
  const base = buildVisualStylePatch(widget.style, 'base');
  const hover = buildVisualStylePatch(widget.style, 'hover');
  const active = buildVisualStylePatch(widget.style, 'active');
  return {
    base,
    hover: Object.values(hover).some((value) => value != null && value !== '') ? hover : undefined,
    active: Object.values(active).some((value) => value != null && value !== '') ? active : undefined,
  };
}

function buildTargetVisualStates(widget: WidgetNode): ExportTargetVisualStates | undefined {
  if (widget.type === 'buttons') {
    const accent = String(widget.style.accentColor ?? '#67e8f9');
    return {
      'primary-button': {
        base: {
          backgroundColor: accent,
          color: '#0f172a',
          borderColor: accent,
        },
        hover: {
          backgroundColor: String(widget.style.hoverBackgroundColor ?? '#ffffff'),
          color: String(widget.style.hoverColor ?? '#0f172a'),
          boxShadow: String(widget.style.hoverShadow ?? '0 12px 22px rgba(0,0,0,0.18)'),
        },
        active: {
          backgroundColor: String(widget.style.activeBackgroundColor ?? '#ffffff'),
          color: String(widget.style.activeColor ?? '#0f172a'),
          boxShadow: String(widget.style.activeShadow ?? '0 14px 26px rgba(0,0,0,0.22)'),
        },
      },
      'secondary-button': {
        base: {
          backgroundColor: 'transparent',
          color: String(widget.style.color ?? '#ffffff'),
          borderColor: accent,
        },
        hover: {
          backgroundColor: String(widget.style.hoverBackgroundColor ?? `${accent}22`),
          color: String(widget.style.hoverColor ?? '#ffffff'),
          borderColor: String(widget.style.hoverBorderColor ?? accent),
        },
        active: {
          backgroundColor: String(widget.style.activeBackgroundColor ?? `${accent}33`),
          color: String(widget.style.activeColor ?? '#ffffff'),
          borderColor: String(widget.style.activeBorderColor ?? accent),
        },
      },
    };
  }

  if (widget.type === 'interactive-hotspot') {
    const accent = String(widget.style.accentColor ?? '#f59e0b');
    return {
      'hotspot-pin': {
        base: {
          backgroundColor: accent,
          boxShadow: '0 0 0 6px rgba(245,158,11,.24), 0 0 0 18px rgba(245,158,11,.1)',
        },
        hover: {
          backgroundColor: String(widget.style.hoverBackgroundColor ?? accent),
          boxShadow: String(widget.style.hoverShadow ?? '0 0 0 8px rgba(245,158,11,.28), 0 0 0 22px rgba(245,158,11,.12)'),
        },
        active: {
          backgroundColor: String(widget.style.activeBackgroundColor ?? accent),
          boxShadow: String(widget.style.activeShadow ?? '0 0 0 10px rgba(245,158,11,.24), 0 0 0 24px rgba(245,158,11,.14)'),
        },
      },
      'hotspot-card': {
        base: {
          backgroundColor: 'rgba(15,23,42,.82)',
          color: String(widget.style.color ?? '#ffffff'),
          borderColor: 'rgba(255,255,255,.08)',
        },
        hover: {
          backgroundColor: String(widget.style.hoverBackgroundColor ?? 'rgba(15,23,42,.92)'),
          color: String(widget.style.hoverColor ?? '#ffffff'),
          borderColor: String(widget.style.hoverBorderColor ?? accent),
        },
        active: {
          backgroundColor: String(widget.style.activeBackgroundColor ?? 'rgba(17,24,39,.96)'),
          color: String(widget.style.activeColor ?? '#ffffff'),
          borderColor: String(widget.style.activeBorderColor ?? accent),
        },
      },
    };
  }

  return undefined;
}

export function buildExportModel(state: StudioState, options: ExportBuildOptions = {}): ExportModel {
  const capabilitySummary = resolveExportCapabilities(state);
  const qualityProfile = options.qualityProfile ?? 'medium';
  const scenes = state.document.scenes
    .filter((scene) => sceneMatchesConditions(scene, state))
    .sort((a, b) => a.order - b.order);

  const assets: ExportAsset[] = [];
  const exits: ExportExit[] = [];
  const sceneActions: ExportSceneAction[] = [];
  const widgetActionBindings: ExportWidgetAction[] = [];
  const textActions: ExportTextAction[] = [];
  const nodes: ExportNode[] = [];
  const exportScenes: ExportScene[] = [];
  const targetCoverage: ExportTargetCoverage[] = [];

  scenes.forEach((scene) => {
    const sceneNodeIds: string[] = [];

    scene.widgetIds
      .map((id) => state.document.widgets[id])
      .filter(Boolean)
      .map((widget) => resolveWidgetSnapshot(widget, state))
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((widget) => {
        const capability = [
          ...capabilitySummary.supported,
          ...capabilitySummary.degraded,
          ...capabilitySummary.blockers,
        ].find((item) => item.widgetId === widget.id);

        const widgetAssets = assetFromWidget(widget, { qualityProfile });
        const widgetBehaviorActions = Object.values(state.document.actions).filter((action) => action.widgetId === widget.id);
        const widgetExits = exitsFromActions(widget, widgetBehaviorActions);
        const widgetSceneActions = sceneActionsFromActions(widget, widgetBehaviorActions, state);
        const widgetWidgetActions = widgetActionsFromActions(widget, widgetBehaviorActions, state);
        const widgetTextActions = textActionsFromActions(widget, widgetBehaviorActions, state);
        const widgetCoverage = coverageFromWidget(widget, widgetExits);

        assets.push(...widgetAssets);
        exits.push(...widgetExits);
        sceneActions.push(...widgetSceneActions);
        widgetActionBindings.push(...widgetWidgetActions);
        textActions.push(...widgetTextActions);
        if (widgetCoverage) targetCoverage.push(widgetCoverage);

        nodes.push({
          widgetId: widget.id,
          widgetName: widget.name,
          widgetType: widget.type,
          sceneId: scene.id,
          bounds: {
            x: widget.frame.x,
            y: widget.frame.y,
            width: widget.frame.width,
            height: widget.frame.height,
            rotation: widget.frame.rotation,
          },
          zIndex: widget.zIndex,
          hidden: Boolean(widget.hidden),
          exportKind: capability?.exportKind ?? 'omit',
          capabilityStatus: capability?.status ?? 'unsupported',
          degradationStrategy: capability?.degradationStrategy,
          capabilityNotes: capability?.notes,
          assetIds: widgetAssets.map((asset) => asset.id),
          exitIds: widgetExits.map((exit) => exit.id),
          visualStates: buildVisualStates(widget),
          targetVisualStates: buildTargetVisualStates(widget),
        });

        sceneNodeIds.push(widget.id);
      });

    exportScenes.push({
      id: scene.id,
      name: scene.name,
      order: scene.order,
      durationMs: scene.durationMs,
      transition: scene.transition,
      nodeIds: sceneNodeIds,
    });
  });

  const assetSummary = {
    bundledCount: assets.filter((asset) => asset.packaging === 'bundled').length,
    externalReferenceCount: assets.filter((asset) => asset.packaging === 'external-reference').length,
    dataUrlCount: assets.filter((asset) => asset.source === 'data-url').length,
    remoteUrlCount: assets.filter((asset) => asset.source === 'remote-url').length,
    blobUrlCount: assets.filter((asset) => asset.source === 'blob-url').length,
  };

  return {
    interactionTier: capabilitySummary.selectedTier,
    highestRequiredTier: capabilitySummary.highestRequiredTier,
    qualityProfile,
    initialSceneId: exportScenes[0]?.id,
    scenes: exportScenes,
    nodes,
    exits,
    sceneActions,
    widgetActions: widgetActionBindings,
    textActions,
    assets,
    assetSummary,
    targetCoverage,
  };
}
