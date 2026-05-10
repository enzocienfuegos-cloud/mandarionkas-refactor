import { useState } from 'react';
import { CATEGORY_ORDER, type LeftRailController } from './use-left-rail-controller';
import { clearWidgetLibraryDragPayload, createWidgetLibraryDragPayload, writeWidgetLibraryDragPayload } from '../../../canvas/stage/widget-library-drag';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';
import { PlaceholderThumb } from '../../../widgets/registry/widget-thumbnails';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

const CAPABILITY_PILLS: Array<{ key: keyof NonNullable<LeftRailController['filteredWidgets'][number]['capabilities']>; label: string }> = [
  { key: 'isInteractive', label: 'Interactive' },
  { key: 'isMedia', label: 'Media' },
  { key: 'isContainer', label: 'Container' },
  { key: 'acceptsAssetSwap', label: 'Asset swap' },
  { key: 'isAssetGallery', label: 'Gallery' },
  { key: 'hasVideoAnalytics', label: 'Analytics' },
];

export function getCapabilityPills(widget: LeftRailController['filteredWidgets'][number]): string[] {
  const pills = CAPABILITY_PILLS.filter((item) => widget.capabilities?.[item.key]).map((item) => item.label);
  return pills.length ? pills.slice(0, 3) : [widget.category];
}

export function getMraidLabel(level: LeftRailController['filteredWidgets'][number]['mraidCompatibility']): string | null {
  if (level === 'supported') return 'MRAID ready';
  if (level === 'warning') return 'MRAID review';
  if (level === 'blocked') return 'MRAID blocked';
  return null;
}

export function getMetadataPills(widget: LeftRailController['filteredWidgets'][number]): string[] {
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

export function WidgetLibrarySection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { filteredWidgets, query, setQuery, category, setCategory, counts, widgetActions } = controller;
  const [draggingWidgetType, setDraggingWidgetType] = useState<string | null>(null);
  const [previewWidgetType, setPreviewWidgetType] = useState<string | null>(null);
  const categoryOptions = [
    { id: 'all' as const, label: 'All' },
    ...CATEGORY_ORDER.map((item) => ({ id: item, label: item, count: counts[item] })),
  ];

  function renderWidgetThumbnail(widget: LeftRailController['filteredWidgets'][number], previewActive: boolean): JSX.Element {
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

  return (
    <>
      <div className="left-rail-section-head">
        <div>
          <div className="left-title">Widget Library</div>
          <strong className="rail-heading">Canvas modules</strong>
        </div>
        <div className="pill">{filteredWidgets.length} shown</div>
      </div>

      <div className="field-stack rail-search-stack">
        <input aria-label="Search widgets" placeholder="Search modules..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} ariaLabel="Widget categories" className="chip-row" />
      </div>

      <div className="widget-library-grid">
        {filteredWidgets.map((widget) => {
          const metadataPills = getMetadataPills(widget);
          const capabilityPills = getCapabilityPills(widget);
          return (
            <div
            key={widget.type}
            draggable
            role="button"
            tabIndex={0}
            data-widget-type={widget.type}
            className={`left-button widget-library-card ${draggingWidgetType === widget.type ? 'is-dragging' : ''}`}
            aria-label={`${widget.label} widget. Click to add or drag to canvas.`}
            onClick={() => widgetActions.createWidget(widget.type)}
            onMouseEnter={() => setPreviewWidgetType(widget.type)}
            onMouseLeave={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
            onFocus={() => setPreviewWidgetType(widget.type)}
            onBlur={() => setPreviewWidgetType((current) => (current === widget.type ? null : current))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                widgetActions.createWidget(widget.type);
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
              {renderWidgetThumbnail(widget, previewWidgetType === widget.type)}
            </div>

            <div className="widget-library-card__meta">
              <div className="widget-library-card__header">
                <div className="content-min-w-0">
                  <div className="widget-library-card__label">{widget.label}</div>
                  {widget.description ? (
                    <div className="widget-library-card__description">{widget.description}</div>
                  ) : null}
                </div>
              </div>
              {metadataPills.length ? (
                <div className="widget-library-card__metrics">
                  {metadataPills.map((item) => (
                    <span key={item} className="widget-library-card__metric">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="widget-library-card__capabilities">
                {capabilityPills.map((item) => (
                  <span key={item} className="widget-library-card__capability">
                    <StudioIcon icon={getCapabilityIcon(item)} size={12} />
                    {item}
                  </span>
                ))}
              </div>
              <div className="widget-library-card__hint">Click to add or drag to canvas</div>
            </div>
          </div>
          );
        })}
      </div>
    </>
  );
}
