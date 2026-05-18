import { useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';
import { useMotionPreview } from './use-motion-preview';

type MotionTemplateGalleryProps = {
  templates: MotionTemplate[];
  selectedTemplateId?: string | null;
  configByTemplateId?: Partial<Record<string, MotionConfig>>;
  onSelect: (templateId: string | null) => void;
  emptyLabel?: string;
  renderSelectedContent?: (template: MotionTemplate) => ReactNode;
};

function MotionGalleryTile({
  template,
  selected,
  config,
  onClick,
  children,
}: {
  template: MotionTemplate;
  selected: boolean;
  config: MotionConfig;
  onClick: () => void;
  children?: ReactNode;
}): JSX.Element {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  useMotionPreview({
    ref: previewRef,
    template,
    config,
    baseOpacity: 1,
    active: previewActive,
  });

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setPreviewActive(false);
    }
  };

  return (
    <div
      className={`motion-gallery-tile ${selected ? 'is-selected' : ''} ${previewActive ? 'is-previewing' : ''}`}
      onPointerEnter={() => setPreviewActive(true)}
      onPointerLeave={() => setPreviewActive(false)}
      onFocusCapture={() => setPreviewActive(true)}
      onBlurCapture={handleBlur}
    >
      <button
        type="button"
        className="motion-gallery-tile__button"
        onClick={onClick}
        title={template.description ?? template.label}
      >
        <div className="motion-gallery-tile__preview">
          <div ref={previewRef} className="motion-gallery-tile__preview-inner">
            {template.thumbnail(config)}
          </div>
        </div>
        <div className="motion-gallery-tile__meta">
          <strong>{template.label}</strong>
          {template.description ? <small>{template.description}</small> : null}
        </div>
      </button>
      {selected && children ? <div className="motion-gallery-tile__config">{children}</div> : null}
    </div>
  );
}

export function MotionTemplateGallery({
  templates,
  selectedTemplateId,
  configByTemplateId,
  onSelect,
  emptyLabel = 'Custom / none',
  renderSelectedContent,
}: MotionTemplateGalleryProps): JSX.Element {
  const sortedTemplates = useMemo(() => templates.slice().sort((left, right) => left.label.localeCompare(right.label)), [templates]);
  return (
    <div className="motion-gallery">
      <button type="button" className={`motion-gallery-reset ${!selectedTemplateId ? 'is-selected' : ''}`} onClick={() => onSelect(null)}>
        {emptyLabel}
      </button>
      <div className="motion-gallery-grid">
        {sortedTemplates.map((template) => (
          <MotionGalleryTile
            key={template.id}
            template={template}
            selected={template.id === selectedTemplateId}
            config={configByTemplateId?.[template.id] ?? template.defaults}
            onClick={() => onSelect(template.id)}
          >
            {template.id === selectedTemplateId ? renderSelectedContent?.(template) : null}
          </MotionGalleryTile>
        ))}
      </div>
    </div>
  );
}
