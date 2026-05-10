import { useEffect, useRef, type CSSProperties, type Dispatch, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';
import type { WidgetDefinition } from '../../../widgets/registry/widget-definition';
import { WIDGET_LIBRARY_GROUP_LABELS } from '../../../widgets/registry/widget-definition';
import { PlaceholderThumb } from '../../../widgets/registry/widget-thumbnails';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
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
        className={`widget-library-row ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
        aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
        style={cardStyle}
        onClick={addWidget}
        onMouseEnter={() => setPreviewWidgetType(widget.type)}
        onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
        onFocus={() => setPreviewWidgetType(widget.type)}
        onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
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
        <span className="widget-library-row__thumb">
          <span className="widget-library-row__thumb-stage">
            {renderWidgetThumbnail(widget, previewActive)}
          </span>
        </span>
        <span className="widget-library-row__label">{widget.label}</span>
        <IconButton
          variant="ghost"
          size="sm"
          className="widget-library-row__preview"
          label={`Preview ${widget.label}`}
          icon={<StudioIcon icon={StudioIcons.scanSearch} size={12} />}
          draggable={false}
          onPointerDown={stopNestedDragInteraction}
          onDragStart={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetails();
          }}
        />
        {widget.requiresAsset ? <StudioIcon icon={StudioIcons.upload} size={12} className="widget-library-row__hint" aria-hidden="true" /> : null}
      </div>
    );
  }

  if (density === 'expanded') {
    return (
      <div
        draggable
        role="button"
        tabIndex={0}
        data-widget-type={widget.type}
        data-library-group={group}
        className={`widget-library-cozy-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
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
        <div className="widget-library-cozy-card__thumb">
          {renderWidgetThumbnail(widget, previewActive)}
        </div>
        <div className="widget-library-cozy-card__meta">
          <strong>{widget.label}</strong>
          <small>{widget.libraryTags?.[0] ?? sectionLabel}</small>
        </div>
        <div className="widget-library-cozy-card__actions">
          <Button
            variant="ghost"
            size="sm"
            className="widget-library-cozy-card__preview-btn"
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
    );
  }

  return (
    <div
        draggable
        role="button"
        tabIndex={0}
        data-widget-type={widget.type}
        data-library-group={group}
        className={`widget-library-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
        aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
        style={cardStyle}
        onClick={addWidget}
      onMouseEnter={() => setPreviewWidgetType(widget.type)}
      onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onFocus={() => setPreviewWidgetType(widget.type)}
      onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpenDetails();
        }
        if (event.key === ' ') {
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
      <div className="widget-library-card__body">
        <div className="widget-library-card__thumb">
          <div className="widget-library-card__thumb-stage">
            {renderWidgetThumbnail(widget, previewActive)}
          </div>
        </div>

        <div className="widget-library-card__meta">
          <div className="widget-library-card__header">
            <div className="content-min-w-0">
              <div className={`widget-library-card__eyebrow chip ${category.badgeClass} is-active`}>
                {WIDGET_LIBRARY_GROUP_LABELS[group] ?? sectionLabel}
              </div>
            </div>
            <span className="widget-library-card__add" aria-hidden="true">
              <StudioIcon icon={StudioIcons.plus} size={12} />
              Add
            </span>
          </div>
          <div className="widget-library-card__copy">
            <div className="widget-library-card__label">{widget.label}</div>
            {widget.description ? <div className="widget-library-card__description">{widget.description}</div> : null}
          </div>
          {widget.libraryTags?.length ? (
            <div className="widget-library-card__tags">
              {widget.libraryTags.slice(0, 2).map((item) => (
                <span key={item} className="widget-library-card__tag">{item}</span>
              ))}
            </div>
          ) : null}
          <div className="widget-library-card__capabilities">
            {capabilityPills.slice(0, 2).map((item) => (
              <span key={item} className="widget-library-card__capability">
                <StudioIcon icon={getCapabilityIcon(item)} size={12} />
                {item}
              </span>
            ))}
          </div>
          {metadataPills.length ? (
            <div className="widget-library-card__metrics">
              {metadataPills.slice(0, 2).map((item) => (
                <span key={item} className="widget-library-card__metric">{item}</span>
              ))}
            </div>
          ) : null}
          <div className="widget-library-card__footer">
            <div className="widget-library-card__hint">Click to add · drag to canvas</div>
            <div className="widget-library-card__footer-actions">
              <div className="widget-library-card__type">{previewActive ? 'Previewing' : 'Ready'}</div>
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
    </div>
  );
}
