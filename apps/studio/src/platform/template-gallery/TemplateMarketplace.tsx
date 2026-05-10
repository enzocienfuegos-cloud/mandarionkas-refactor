import { useMemo, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { listTemplates } from '../../templates/library/registry';
import type { StudioTemplate, StudioTemplateVertical } from '../../templates/library/types';
import { TemplateCard } from './TemplateCard';

const VERTICAL_LABELS: Record<StudioTemplateVertical, string> = {
  auto: 'Auto',
  cpg: 'CPG',
  custom: 'Custom',
  ecommerce: 'E-commerce',
  finance: 'Finance',
  sports: 'Sports',
};

type TemplateMarketplaceProps = {
  clientId?: string;
  onUseTemplate(templateId: string, targetClientId?: string): void;
  onBlankCanvas?(): void;
  showVerticalFilters?: boolean;
  includeBlankAndStarterPaths?: boolean;
};

export function TemplateMarketplace({
  clientId,
  onUseTemplate,
  onBlankCanvas,
  showVerticalFilters = true,
  includeBlankAndStarterPaths = false,
}: TemplateMarketplaceProps): JSX.Element {
  const allTemplates = useMemo(() => listTemplates(), []);
  const [activeVertical, setActiveVertical] = useState<StudioTemplateVertical | 'all'>('all');

  const filteredTemplates = useMemo(
    () => activeVertical === 'all' ? allTemplates : allTemplates.filter((template) => template.metadata.vertical === activeVertical),
    [activeVertical, allTemplates],
  );

  const featuredTemplate = useMemo<StudioTemplate | null>(
    () => filteredTemplates.find((template) => template.metadata.featured) ?? filteredTemplates[0] ?? null,
    [filteredTemplates],
  );

  const galleryTemplates = useMemo(
    () => filteredTemplates.filter((template) => template.metadata.id !== featuredTemplate?.metadata.id),
    [featuredTemplate, filteredTemplates],
  );

  return (
    <section className="template-marketplace">
      {showVerticalFilters ? (
        <div className="template-marketplace__filters" role="tablist" aria-label="Template vertical">
          <button
            type="button"
            role="tab"
            aria-selected={activeVertical === 'all'}
            className={`chip-filter ${activeVertical === 'all' ? 'is-active' : ''}`.trim()}
            onClick={() => setActiveVertical('all')}
          >
            All <span className="chip-filter__count">{allTemplates.length}</span>
          </button>
          {(Object.keys(VERTICAL_LABELS) as StudioTemplateVertical[]).map((vertical) => {
            const count = allTemplates.filter((template) => template.metadata.vertical === vertical).length;
            if (count === 0) return null;
            return (
              <button
                key={vertical}
                type="button"
                role="tab"
                aria-selected={activeVertical === vertical}
                className={`chip-filter ${activeVertical === vertical ? 'is-active' : ''}`.trim()}
                onClick={() => setActiveVertical(vertical)}
              >
                {VERTICAL_LABELS[vertical]} <span className="chip-filter__count">{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {featuredTemplate ? (
        <div className="template-marketplace__featured">
          <TemplateCard template={featuredTemplate} variant="featured" onUse={(id) => onUseTemplate(id, clientId)} />
        </div>
      ) : null}

      <div className="template-marketplace__grid">
        {galleryTemplates.map((template) => (
          <TemplateCard key={template.metadata.id} template={template} variant="standard" onUse={(id) => onUseTemplate(id, clientId)} />
        ))}
        {includeBlankAndStarterPaths && onBlankCanvas ? (
          <button type="button" className="template-marketplace__blank-card" onClick={onBlankCanvas}>
            <span className="template-marketplace__blank-icon">
              <StudioIcon icon={StudioIcons.plus} size={28} />
            </span>
            <strong>Blank canvas</strong>
            <small>Open the editor with full control over size, layout and motion.</small>
          </button>
        ) : null}
      </div>
      {includeBlankAndStarterPaths && onBlankCanvas ? (
        <div className="template-marketplace__footer-actions">
          <Button variant="ghost" size="md" onClick={onBlankCanvas}>
            Open blank canvas
          </Button>
        </div>
      ) : null}
    </section>
  );
}
