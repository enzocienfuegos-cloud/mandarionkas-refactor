import { useEffect, useRef, type CSSProperties, type Dispatch, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';
import type { WidgetDefinition } from '../../../widgets/registry/widget-definition';
import { PlaceholderThumb } from '../../../widgets/registry/widget-thumbnails';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Button } from '../../../shared/ui/Button';
import { CATEGORY_COLOR } from './widget-library-category-colors';

const CAPABILITY_PILLS: Array<{ key: keyof NonNullable<WidgetDefinition['capabilities']>; label: string }> = [
  { key: 'isInteractive', label: 'Interactive' },
  { key: 'isMedia', label: 'Media' },
  { key: 'isContainer', label: 'Container' },
  { key: 'acceptsAssetSwap', label: 'Asset swap' },
  { key: 'isAssetGallery', label: 'Gallery' },
  { key: 'hasVideoAnalytics', label: 'Analytics' },
];

export type WidgetLibraryItem = WidgetDefinition;

type WidgetPreviewIntent = 'pan' | 'slide' | 'carousel' | 'pulse';

export function getCapabilityPills(widget: WidgetLibraryItem): string[] {
  const pills = CAPABILITY_PILLS.filter((item) => widget.capabilities?.[item.key]).map((item) => item.label);
  return pills.length ? pills.slice(0, 3) : [widget.category];
}

export function getMraidLabel(level: WidgetLibraryItem['mraidCompatibility']): string | null {
  if (level === 'supported') return 'MRAID ready';
  if (level === 'warning') return 'MRAID review';
  if (level === 'blocked') return 'MRAID blocked';
  return null;
}

export function getMetadataPills(widget: WidgetLibraryItem): string[] {
  const pills: string[] = [];
  if (widget.recommendedSize) {
    const { width, height, label } = widget.recommendedSize;
    pills.push(label ? `${label} · ${width}×${height}` : `${width}×${height}`);
  }
  if (typeof widget.estimatedRuntimeKb === 'number') {
    pills.push(`${widget.estimatedRuntimeKb} KB runtime`);
  }
  const mraidLabel = getMraidLabel(widget.mraidCompatibility);
  if (mraidLabel) pills.push(mraidLabel);
  if (widget.requiresAsset) pills.push('Needs assets');
  return pills.slice(0, 3);
}

function getWidgetPreviewIntent(widget: WidgetLibraryItem): WidgetPreviewIntent {
  const type = widget.type.toLowerCase();
  const tags = (widget.libraryTags ?? []).map((item) => item.toLowerCase());

  if (
    type.includes('carousel')
    || type.includes('gallery')
    || tags.some((item) => ['carousel', 'gallery', 'slides', 'story'].includes(item))
  ) {
    return 'carousel';
  }

  if (
    type.includes('slider')
    || type.includes('countdown')
    || type.includes('timer')
    || tags.some((item) => ['swipe', 'drag', 'range', 'progress', 'countdown', 'timer'].includes(item))
  ) {
    return 'slide';
  }

  if (
    widget.category === 'media'
    || type.includes('image')
    || type.includes('video')
    || tags.some((item) => ['hero', 'cover', 'photo', 'image', 'video'].includes(item))
  ) {
    return 'pan';
  }

  return 'pulse';
}

function getCapabilityIcon(label: string) {
  switch (label) {
    case 'Interactive':
      return StudioIcons.workflow;
    case 'Media':
      return StudioIcons.images;
    case 'Container':
      return StudioIcons.boxes;
    case 'Asset swap':
      return StudioIcons.upload;
    case 'Gallery':
      return StudioIcons.library;
    default:
      return StudioIcons.info;
  }
}

export function renderWidgetThumbnail(
  widget: WidgetLibraryItem,
  previewActive: boolean,
  preferWireframe = false,
): JSX.Element {
  if (preferWireframe && widget.renderWireframe) {
    return (
      <div className="widget-library-wireframe-thumb">
        {widget.renderWireframe(widget.defaults('preview-scene', 0), { previewMode: false, playheadMs: 0, sceneDurationMs: 15000, hovered: false, active: false, triggerWidgetAction: () => undefined, executeAction: () => undefined })}
      </div>
    );
  }

  if (previewActive && widget.renderLibraryPreview) {
    const LibraryPreview = widget.renderLibraryPreview;
    return <LibraryPreview />;
  }

  if (typeof widget.thumbnail === 'string') {
    return <img src={widget.thumbnail} alt="" className="widget-library-card__thumb-image" loading="lazy" />;
  }

  if (widget.thumbnail) {
    const Thumbnail = widget.thumbnail;
    return <Thumbnail />;
  }

  return <PlaceholderThumb category={widget.category} />;
}

function stopNestedDragInteraction(event: ReactPointerEvent<HTMLElement> | ReactMouseEvent<HTMLElement> | ReactDragEvent<HTMLElement>): void {
  event.stopPropagation();
}

export function WidgetLibraryItemCard({
  widget,
  sectionLabel,
  density,
  draggingWidgetType,
  previewWidgetType,
  setDraggingWidgetType,
  setPreviewWidgetType,
  onCreate,
  onOpenDetails,
}: {
  widget: WidgetLibraryItem;
  sectionLabel: string;
  density: 'compact' | 'expanded';
  draggingWidgetType: string | null;
  previewWidgetType: string | null;
  setDraggingWidgetType: Dispatch<SetStateAction<string | null>>;
  setPreviewWidgetType: Dispatch<SetStateAction<string | null>>;
  onCreate(widgetType: WidgetLibraryItem['type']): void;
  onOpenDetails(): void;
}): JSX.Element {
  const metadataPills = getMetadataPills(widget);
  const capabilityPills = getCapabilityPills(widget);
  const previewActive = previewWidgetType === widget.type;
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const group = widget.libraryGroup ?? 'essentials';
  const category = CATEGORY_COLOR[group];
  const previewIntent = getWidgetPreviewIntent(widget);
  const cardStyle = {
    '--widget-library-thumb-tint': category.thumbTint,
  } as CSSProperties;

  useEffect(() => () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const addWidget = () => {
    onCreate(widget.type);
  };

  if (density === 'compact') {
    return (
      <div
        draggable
        role="button"
        tabIndex={0}
        data-widget-type={widget.type}
        data-library-group={group}
        data-preview-intent={previewIntent}
        className={`widget-library-row ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
        aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
        style={cardStyle}
        onDoubleClick={(event) => {
          event.preventDefault();
          onOpenDetails();
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (event.altKey) {
            onOpenDetails();
            return;
          }
          addWidget();
        }}
        onMouseEnter={() => setPreviewWidgetType(widget.type)}
        onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
        onFocus={() => setPreviewWidgetType(widget.type)}
        onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          clearLongPress();
          suppressClickRef.current = false;
          longPressTimerRef.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            onOpenDetails();
          }, 420);
        }}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            addWidget();
          }
        }}
        onDragStart={(event) => {
          setDraggingWidgetType(widget.type);
          writeWidgetLibraryDragPayload(event.dataTransfer, createWidgetLibraryDragPayload(widget.type, widget.label));
        }}
        onDragEnd={() => {
          setDraggingWidgetType(null);
          clearWidgetLibraryDragPayload();
        }}
      >
        <div className="widget-library-row__thumb" aria-hidden="true">
          <div className="widget-library-row__thumb-stage">
            {renderWidgetThumbnail(widget, previewActive, true)}
          </div>
        </div>
        <div className="widget-library-row__meta">
          <span className="widget-library-row__label">{widget.label}</span>
        </div>
        {widget.capabilities?.acceptsAssetSwap ? (
          <span className="widget-library-row__addon" aria-hidden="true">
            <StudioIcon icon={StudioIcons.upload} size={14} />
          </span>
        ) : null}
      </div>
    );
  }

  const railTags = widget.libraryTags?.slice(0, 2) ?? [];
  const railCapabilities = capabilityPills.slice(0, 2);
  const railMetrics = metadataPills.slice(0, 2);

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      data-widget-type={widget.type}
      data-library-group={group}
      data-preview-intent={previewIntent}
      className={`template-rail-card widget-rail-card widget-rail-card--${density} ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
      aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
      style={cardStyle}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (event.altKey) {
          onOpenDetails();
          return;
        }
        addWidget();
      }}
      onMouseEnter={() => setPreviewWidgetType(widget.type)}
      onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onFocus={() => setPreviewWidgetType(widget.type)}
      onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        clearLongPress();
        suppressClickRef.current = false;
        longPressTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = true;
          onOpenDetails();
        }, 420);
      }}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          addWidget();
        }
      }}
      onDragStart={(event) => {
        setDraggingWidgetType(widget.type);
        writeWidgetLibraryDragPayload(event.dataTransfer, createWidgetLibraryDragPayload(widget.type, widget.label));
      }}
      onDragEnd={() => {
        setDraggingWidgetType(null);
        clearWidgetLibraryDragPayload();
      }}
    >
      <div className="template-rail-card__body widget-rail-card__body">
        <div className="template-rail-card__media widget-rail-card__media">
          <div className="template-rail-card__media-visual widget-rail-card__media-visual">
            {renderWidgetThumbnail(widget, previewActive)}
          </div>
        </div>

        <div className="template-rail-card__meta widget-rail-card__meta">
          <div className="template-rail-card__header widget-rail-card__header">
            <div className="template-rail-card__eyebrows widget-rail-card__eyebrows">
              <div className={`template-rail-card__eyebrow widget-rail-card__eyebrow ${category.badgeClass} is-active`}>
                {sectionLabel}
              </div>
              {railMetrics[0] ? <span className="template-rail-card__tag widget-rail-card__tag">{railMetrics[0]}</span> : null}
            </div>
          </div>
          <div className="template-rail-card__copy widget-rail-card__copy">
            <h3>{widget.label}</h3>
            {widget.description ? <p>{widget.description}</p> : null}
          </div>
          {railTags.length ? (
            <div className="template-rail-card__tags widget-rail-card__tags">
              {railTags.map((item) => (
                <span key={item} className="template-rail-card__tag widget-rail-card__tag">{item}</span>
              ))}
            </div>
          ) : null}
          <div className="template-rail-card__facts widget-rail-card__facts">
            {railCapabilities.map((item) => (
              <span key={item} className="template-rail-card__capability widget-rail-card__capability">
                <StudioIcon icon={getCapabilityIcon(item)} size={12} />
                {item}
              </span>
            ))}
            {railMetrics.slice(1).map((item) => (
              <span key={item} className="template-rail-card__tag widget-rail-card__tag">{item}</span>
            ))}
            {!railMetrics.length && widget.requiresAsset ? (
              <span className="template-rail-card__tag widget-rail-card__tag">Needs assets</span>
            ) : null}
            {!railMetrics.length && !widget.requiresAsset && widget.libraryTags?.[0] ? (
              <span className="template-rail-card__tag widget-rail-card__tag">{widget.libraryTags[0]}</span>
            ) : null}
          </div>
          <div className="template-rail-card__footer widget-rail-card__footer">
            <div className="template-rail-card__hint widget-rail-card__hint">
              Click to add · drag to canvas
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="widget-library-card__detail-btn"
              draggable={false}
              onPointerDown={stopNestedDragInteraction}
              onDragStart={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails();
              }}
            >
              Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
