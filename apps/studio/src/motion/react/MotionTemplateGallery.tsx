import { useMemo, useRef } from 'react';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';
import { useMotionPreview } from './use-motion-preview';

type MotionTemplateGalleryProps = {
  templates: MotionTemplate[];
  selectedTemplateId?: string | null;
  configByTemplateId?: Partial<Record<string, MotionConfig>>;
  onSelect: (templateId: string | null) => void;
  emptyLabel?: string;
};

function MotionGalleryTile({
  template,
  selected,
  config,
  onClick,
}: {
  template: MotionTemplate;
  selected: boolean;
  config: MotionConfig;
  onClick: () => void;
}): JSX.Element {
  const ref = useRef<HTMLButtonElement | null>(null);
  useMotionPreview({
    ref,
    template,
    config,
    baseOpacity: 1,
    active: true,
  });

  return (
    <button type="button" ref={ref} className={`motion-gallery-tile ${selected ? 'is-selected' : ''}`} onClick={onClick}>
      <div className="motion-gallery-tile__preview">{template.thumbnail(config)}</div>
      <div className="motion-gallery-tile__meta">
        <strong>{template.label}</strong>
        {template.description ? <small>{template.description}</small> : null}
      </div>
    </button>
  );
}

export function MotionTemplateGallery({
  templates,
  selectedTemplateId,
  configByTemplateId,
  onSelect,
  emptyLabel = 'Custom / none',
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
          />
        ))}
      </div>
    </div>
  );
}
