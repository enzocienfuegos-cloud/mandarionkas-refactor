import { useMemo, useState } from 'react';
import { listTemplates } from '../../templates/library/registry';
import type { StudioTemplateVertical } from '../../templates/library/types';
import { Button } from '../../shared/ui/Button';
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
  const featuredTemplate = useMemo(
    () => filteredTemplates.find((template) => template.metadata.featured) ?? filteredTemplates[0] ?? null,
    [filteredTemplates],
  );
  const galleryTemplates = useMemo(
    () => filteredTemplates.filter((template) => template.metadata.id !== featuredTemplate?.metadata.id),
    [featuredTemplate, filteredTemplates],
  );

  return (
    <section className="template-gallery">
      <div className="template-gallery__head">
        <div>
          <p className="section-kicker">Templates</p>
          <h2>Fewer, stronger launch points</h2>
          <p>Start from a tighter set of campaign-ready structures instead of scrolling through generic placeholders.</p>
        </div>
        <span className="pill">{filteredTemplates.length} visible</span>
      </div>
      <TemplateFilters activeVertical={activeVertical} verticals={verticals} onChange={setActiveVertical} />
      {featuredTemplate ? (
        <article className="template-gallery-featured">
          <div className="template-gallery-featured__copy">
            <div className="template-gallery-featured__eyebrow">
              <span className="pill pill-highlight">{featuredTemplate.metadata.featuredLabel ?? 'Featured starter'}</span>
              <span className="pill">{featuredTemplate.metadata.vertical}</span>
            </div>
            <h3>{featuredTemplate.metadata.name}</h3>
            <p>{featuredTemplate.metadata.description}</p>
            {featuredTemplate.metadata.recommendedFor ? (
              <small>{featuredTemplate.metadata.recommendedFor}</small>
            ) : null}
            <div className="template-gallery-featured__facts">
              {featuredTemplate.metadata.sceneCount ? <span>{featuredTemplate.metadata.sceneCount} scenes</span> : null}
              {(featuredTemplate.metadata.moduleHighlights ?? []).slice(0, 3).map((item) => <span key={item}>{item}</span>)}
            </div>
            <div className="template-gallery-featured__actions">
              <Button variant="primary" size="md" onClick={() => onUseTemplate?.(featuredTemplate.metadata.id)}>
                Use featured starter
              </Button>
            </div>
          </div>
          <div className="template-gallery-featured__media">
            {featuredTemplate.metadata.thumbnail
              ? <img src={featuredTemplate.metadata.thumbnail} alt="" />
              : (
                <div className="template-card__placeholder">
                  <span>{featuredTemplate.metadata.vertical}</span>
                  <strong>{featuredTemplate.metadata.name}</strong>
                </div>
              )}
          </div>
        </article>
      ) : null}
      <div className="template-gallery__grid">
        {galleryTemplates.map((template) => (
          <TemplateCard key={template.metadata.id} template={template} onUse={onUseTemplate} />
        ))}
      </div>
    </section>
  );
}
