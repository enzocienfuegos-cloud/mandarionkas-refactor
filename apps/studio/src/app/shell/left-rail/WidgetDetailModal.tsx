import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { WIDGET_LIBRARY_GROUP_LABELS, type WidgetDefinition } from '../../../widgets/registry/widget-definition';
import { CATEGORY_COLOR } from './widget-library-category-colors';
import { getCapabilityPills, getMetadataPills, renderWidgetThumbnail } from './widget-library-presenters';

const DSP_LABELS = ['Criteo', 'Teads', 'Adform', 'Basis DSP', 'CM360'];

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function WidgetDetailModal({
  widget,
  onClose,
  onCreate,
}: {
  widget: WidgetDefinition;
  onClose(): void;
  onCreate(type: string): void;
}): JSX.Element {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [showWireframe, setShowWireframe] = useState(false);
  const [backdrop, setBackdrop] = useState<'dark' | 'light'>('dark');
  const group = widget.libraryGroup ?? 'essentials';
  const category = CATEGORY_COLOR[group];
  const capabilityPills = getCapabilityPills(widget);
  const metadataPills = getMetadataPills(widget);
  const renderedPreview = useMemo(
    () => renderWidgetThumbnail(widget, !showWireframe, showWireframe),
    [showWireframe, widget],
  );

  useEffect(() => {
    const shell = shellRef.current;
    const focusables = getFocusableElements(shell);
    focusables[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusableElements(shellRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const content = (
    <div
      className="widget-detail-modal-shell"
      role="dialog"
      aria-modal="true"
      aria-label={`${widget.label} widget details`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={shellRef} className="widget-detail-modal">
        <div className={`widget-detail-preview widget-detail-preview--${backdrop}`}>
          <div className="widget-detail-preview-inner">
            {renderedPreview}
          </div>
          <div className="widget-detail-controls">
            <IconButton
              variant="ghost"
              size="sm"
              label={showWireframe ? 'Show live preview' : 'Show wireframe'}
              icon={<StudioIcon icon={StudioIcons.scanSearch} size={14} />}
              onClick={() => setShowWireframe((current) => !current)}
            />
            <IconButton
              variant="ghost"
              size="sm"
              label={backdrop === 'dark' ? 'Use light backdrop' : 'Use dark backdrop'}
              icon={<StudioIcon icon={StudioIcons.circle} size={14} />}
              onClick={() => setBackdrop((current) => current === 'dark' ? 'light' : 'dark')}
            />
          </div>
        </div>

        <aside className="widget-detail-sidebar">
          <IconButton
            className="widget-detail-close"
            variant="ghost"
            size="sm"
            label="Close widget details"
            icon={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          />

          <div className="widget-detail-meta-section">
            <span className={`chip ${category.badgeClass} is-active widget-detail-category-chip`}>
              {WIDGET_LIBRARY_GROUP_LABELS[group]}
            </span>
            <h3 className="widget-detail-title">{widget.label}</h3>
            {widget.description ? <p className="widget-detail-description">{widget.description}</p> : null}
          </div>

          {metadataPills.length ? (
            <div className="widget-detail-meta-section">
              <span className="widget-detail-section-label">Specs</span>
              <div className="widget-detail-pill-row">
                {metadataPills.map((item) => (
                  <span key={item} className="widget-library-card__metric">{item}</span>
                ))}
              </div>
            </div>
          ) : null}

          {capabilityPills.length ? (
            <div className="widget-detail-meta-section">
              <span className="widget-detail-section-label">Capabilities</span>
              <div className="widget-detail-capabilities">
                {capabilityPills.map((capability) => (
                  <div key={capability} className="widget-detail-capability-row">
                    <span className="widget-detail-capability-dot" />
                    <span>{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="widget-detail-meta-section">
            <span className="widget-detail-section-label">Compatible with</span>
            <div className="widget-detail-dsp-row">
              {DSP_LABELS.map((item) => (
                <span key={item} className="widget-detail-dsp-badge">{item}</span>
              ))}
            </div>
          </div>

          {widget.libraryTags?.length ? (
            <div className="widget-detail-meta-section">
              <span className="widget-detail-section-label">Tags</span>
              <div className="chip-row">
                {widget.libraryTags.map((tag) => (
                  <span key={tag} className="chip chip--slate is-active">{tag}</span>
                ))}
              </div>
            </div>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            className="widget-detail-add-btn"
            iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />}
            onClick={() => {
              onCreate(widget.type);
              onClose();
            }}
          >
            Add to canvas
          </Button>
        </aside>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
