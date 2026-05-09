import { useMemo, useState } from 'react';
import { listTemplates } from '../../templates/library/registry';
import type { StudioTemplateVertical } from '../../templates/library/types';
import { TemplateCard } from './TemplateCard';
import { TemplateFilters } from './TemplateFilters';

export function TemplateGallery({
  onUseTemplate,
}: {
  onUseTemplate?: (templateId: string) => void;
}): JSX.Element {
  const [activeVertical, setActiveVertical] = useState<'all' | StudioTemplateVertical>('all');
  const templates = useMemo(() => listTemplates(), []);
  const verticals = useMemo(
    () => Array.from(new Set(templates.map((template) => template.metadata.vertical))).sort() as StudioTemplateVertical[],
    [templates],
  );
  const filteredTemplates = useMemo(
    () => (activeVertical === 'all' ? templates : templates.filter((template) => template.metadata.vertical === activeVertical)),
    [activeVertical, templates],
  );

  return (
    <section className="template-gallery">
      <div className="template-gallery__head">
        <div>
          <p className="section-kicker">Templates</p>
          <h2>Vertical-ready launch points</h2>
          <p>Start from a curated structure instead of rebuilding the same campaign skeleton every time.</p>
        </div>
        <span className="pill">{filteredTemplates.length} visible</span>
      </div>
      <TemplateFilters activeVertical={activeVertical} verticals={verticals} onChange={setActiveVertical} />
      <div className="template-gallery__grid">
        {filteredTemplates.map((template) => (
          <TemplateCard key={template.metadata.id} template={template} onUse={onUseTemplate} />
        ))}
      </div>
    </section>
  );
}
