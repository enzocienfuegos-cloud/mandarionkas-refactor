import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { CATEGORY_ORDER, type LeftRailController } from './use-left-rail-controller';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';
import { PlaceholderThumb } from '../../../widgets/registry/widget-thumbnails';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { WIDGET_LIBRARY_GROUP_LABELS } from '../../../widgets/registry/widget-definition';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';

const CAPABILITY_PILLS: Array<{ key: keyof NonNullable<LeftRailController['filteredWidgets'][number]['capabilities']>; label: string }> = [
  { key: 'isInteractive', label: 'Interactive' },
  { key: 'isMedia', label: 'Media' },
  { key: 'isContainer', label: 'Container' },
  { key: 'acceptsAssetSwap', label: 'Asset swap' },
  { key: 'isAssetGallery', label: 'Gallery' },
  { key: 'hasVideoAnalytics', label: 'Analytics' },
];

export type WidgetCardDensity = 'compact' | 'cozy' | 'expanded';
export type WidgetLibraryItem = LeftRailController['filteredWidgets'][number];

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

function renderWidgetThumbnail(widget: WidgetLibraryItem, previewActive: boolean): JSX.Element {
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

export function WidgetLibraryItemCard({
  widget,
  sectionLabel,
  density,
  draggingWidgetType,
  previewWidgetType,
  setDraggingWidgetType,
  setPreviewWidgetType,
  onCreate,
}: {
  widget: WidgetLibraryItem;
  sectionLabel: string;
  density: WidgetCardDensity;
  draggingWidgetType: string | null;
  previewWidgetType: string | null;
  setDraggingWidgetType: Dispatch<SetStateAction<string | null>>;
  setPreviewWidgetType: Dispatch<SetStateAction<string | null>>;
  onCreate(widgetType: string): void;
}): JSX.Element {
  const metadataPills = getMetadataPills(widget);
  const capabilityPills = getCapabilityPills(widget);
  const previewActive = previewWidgetType === widget.type;

  if (density === 'compact') {
    return (
      <div
        draggable
        role="button"
        tabIndex={0}
        data-widget-type={widget.type}
        className={`widget-library-row ${draggingWidgetType === widget.type ? 'is-dragging' : ''}`.trim()}
        aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
        onClick={() => onCreate(widget.type)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCreate(widget.type);
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
        <span className="widget-library-row__thumb">{renderWidgetThumbnail(widget, false)}</span>
        <span className="widget-library-row__label">{widget.label}</span>
        {widget.requiresAsset ? <StudioIcon icon={StudioIcons.upload} size={12} className="widget-library-row__hint" aria-hidden="true" /> : null}
      </div>
    );
  }

  if (density === 'cozy') {
    return (
      <div
        draggable
        role="button"
        tabIndex={0}
        data-widget-type={widget.type}
        className={`widget-library-cozy-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''}`.trim()}
        aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
        onClick={() => onCreate(widget.type)}
        onMouseEnter={() => setPreviewWidgetType(widget.type)}
        onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
        onFocus={() => setPreviewWidgetType(widget.type)}
        onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onCreate(widget.type);
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
      </div>
    );
  }

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      data-widget-type={widget.type}
      className={`left-button widget-library-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''} ${previewActive ? 'is-preview-active' : ''}`.trim()}
      aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
      onClick={() => onCreate(widget.type)}
      onMouseEnter={() => setPreviewWidgetType(widget.type)}
      onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onFocus={() => setPreviewWidgetType(widget.type)}
      onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onCreate(widget.type);
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
      <div className="widget-library-card__thumb">
        <div className="widget-library-card__thumb-stage">
          {renderWidgetThumbnail(widget, previewActive)}
        </div>
        <div className="widget-library-card__thumb-overlay" aria-hidden="true">
          <span>
            {widget.renderLibraryPreview
              ? (previewActive ? 'Preview live' : 'Hover for motion')
              : ''}
          </span>
          <strong>{widget.recommendedSize?.label ?? sectionLabel}</strong>
        </div>
      </div>

      <div className="widget-library-card__meta">
        <div className="widget-library-card__header">
          <div className="content-min-w-0">
            <div className="widget-library-card__eyebrow">{sectionLabel}</div>
            <div className="widget-library-card__label">{widget.label}</div>
            {widget.description ? <div className="widget-library-card__description">{widget.description}</div> : null}
          </div>
          <span className="widget-library-card__add" aria-hidden="true">
            <StudioIcon icon={StudioIcons.plus} size={12} />
            Add
          </span>
        </div>
        {widget.libraryTags?.length ? (
          <div className="widget-library-card__tags">
            {widget.libraryTags.slice(0, 2).map((item) => (
              <span key={item} className="widget-library-card__tag">{item}</span>
            ))}
          </div>
        ) : null}
        {metadataPills.length ? (
          <div className="widget-library-card__metrics">
            {metadataPills.slice(0, 2).map((item) => (
              <span key={item} className="widget-library-card__metric">{item}</span>
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
        <div className="widget-library-card__footer">
          <div className="widget-library-card__hint">Click to add · drag to canvas</div>
          <div className="widget-library-card__type">{previewActive ? 'Previewing' : 'Ready'}</div>
        </div>
      </div>
    </div>
  );
}

export function WidgetLibraryModal({
  controller,
  onClose,
}: {
  controller: LeftRailController;
  onClose(): void;
}): JSX.Element {
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const [previewWidgetType, setPreviewWidgetType] = useState<string | null>(null);
  const categoryOptions = [
    { id: 'all' as const, label: 'All' },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: WIDGET_LIBRARY_GROUP_LABELS[item], count: controller.counts[item] })),
  ];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="asset-library-modal-shell" role="dialog" aria-modal="true" aria-label="Browse all widgets" onClick={onClose}>
      <div className="widget-library-modal" onClick={(event) => event.stopPropagation()}>
        <div className="asset-library-browser-header">
          <strong>Browse all widgets</strong>
          <span className="muted">Explore the full module catalog with full previews and metadata.</span>
        </div>
        <div className="widget-library-modal__body">
          <div className="field-stack rail-search-stack widget-library-modal__filters">
            <input aria-label="Search widgets" placeholder="Search modules, tags, intent..." value={controller.query} onChange={(event) => controller.setQuery(event.target.value)} />
            <SegmentedControl options={categoryOptions} value={controller.category} onChange={controller.setCategory} ariaLabel="Widget categories" className="chip-row" />
          </div>
          {controller.groupedWidgets.map((section) => (
            <section key={section.group} className="widget-library-section" aria-label={section.label}>
              <div className="widget-library-section__head">
                <div>
                  <div className="left-title">Category</div>
                  <strong className="widget-library-section__title">{section.label}</strong>
                </div>
                <div className="pill">{section.widgets.length}</div>
              </div>
              <div className="widget-library-grid widget-library-grid--expanded">
                {section.widgets.map((widget) => (
                  <WidgetLibraryItemCard
                    key={widget.type}
                    widget={widget}
                    sectionLabel={section.label}
                    density="expanded"
                    draggingWidgetType={draggingWidgetType}
                    previewWidgetType={previewWidgetType}
                    setDraggingWidgetType={setDraggingWidgetType}
                    setPreviewWidgetType={setPreviewWidgetType}
                    onCreate={controller.widgetActions.createWidget}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
