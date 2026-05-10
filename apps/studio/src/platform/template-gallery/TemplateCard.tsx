import type { StudioTemplate } from '../../templates/library/types';
import { Button } from '../../shared/ui/Button';
import { getCanvasPresetById } from '../../domain/document/canvas-presets';

type TemplateCardVariant = 'standard' | 'featured' | 'rail' | 'rail-list';
type TemplatePreviewIntent = 'pan' | 'slide' | 'carousel' | 'pulse';

const VERTICAL_LABELS: Record<StudioTemplate['metadata']['vertical'], string> = {
  auto: 'Auto',
  cpg: 'CPG',
  custom: 'Custom',
  ecommerce: 'Commerce',
  finance: 'Finance',
  sports: 'Sports',
};

function getTemplatePreviewIntent(template: StudioTemplate): TemplatePreviewIntent {
  const tokens = [
    template.metadata.name,
    template.metadata.description,
    ...(template.metadata.tags ?? []),
    ...(template.metadata.moduleHighlights ?? []),
  ].join(' ').toLowerCase();

  if (
    tokens.includes('carousel')
    || tokens.includes('gallery')
    || tokens.includes('story')
    || template.metadata.sceneCount && template.metadata.sceneCount > 2
  ) {
    return 'carousel';
  }

  if (
    tokens.includes('countdown')
    || tokens.includes('timer')
    || tokens.includes('progress')
    || tokens.includes('live')
  ) {
    return 'slide';
  }

  if (
    tokens.includes('hero')
    || tokens.includes('product')
    || tokens.includes('image')
    || tokens.includes('pack')
  ) {
    return 'pan';
  }

  return 'pulse';
}

export function TemplateCard({
  template,
  variant = 'standard',
  onUse,
}: {
  template: StudioTemplate;
  variant?: TemplateCardVariant;
  onUse?: (templateId: string) => void;
}): JSX.Element {
  const preset = template.metadata.canvasPresetId ? getCanvasPresetById(template.metadata.canvasPresetId) : null;
  const highlights = (template.metadata.tags ?? template.metadata.moduleHighlights)?.slice(0, 4) ?? [];
  const railTags = (template.metadata.tags ?? []).slice(0, 2);
  const railHighlights = (template.metadata.moduleHighlights ?? []).slice(0, 2);
  const previewIntent = getTemplatePreviewIntent(template);
  const PreviewComponent = template.metadata.previewComponent;

  if (variant === 'rail') {
    return (
      <article
        className={`template-rail-card ${template.metadata.featured ? 'is-featured' : ''}`.trim()}
        data-preview-intent={previewIntent}
      >
        <div className="template-rail-card__body">
          <div className="template-rail-card__media">
            <div className="template-rail-card__media-visual">
              {PreviewComponent
                ? <PreviewComponent />
                : template.metadata.thumbnail
                  ? <img src={template.metadata.thumbnail} alt="" loading="lazy" />
                  : (
                    <div className="template-rail-card__placeholder">
                      <span>{VERTICAL_LABELS[template.metadata.vertical]}</span>
                      <strong>{template.metadata.name}</strong>
                    </div>
                  )}
            </div>
          </div>
          <div className="template-rail-card__meta">
            <div className="template-rail-card__header">
              <div className="template-rail-card__eyebrows">
                <span className="template-rail-card__eyebrow">
                  {VERTICAL_LABELS[template.metadata.vertical]}
                </span>
                {preset ? <span className="template-rail-card__tag">{preset.label}</span> : null}
              </div>
            </div>
            <div className="template-rail-card__copy">
              <h3>{template.metadata.name}</h3>
              <p>{template.metadata.description}</p>
            </div>
            {template.metadata.recommendedFor ? (
              <div className="template-rail-card__supporting">
                {template.metadata.recommendedFor}
              </div>
            ) : null}
            {railTags.length ? (
              <div className="template-rail-card__tags">
                {railTags.map((highlight) => (
                  <span key={highlight} className="template-rail-card__tag">{highlight}</span>
                ))}
              </div>
            ) : null}
            <div className="template-rail-card__facts">
              {template.metadata.sceneCount ? (
                <span className="template-rail-card__capability">{template.metadata.sceneCount} scenes</span>
              ) : null}
              {template.metadata.featuredLabel ? (
                <span className="template-rail-card__capability">{template.metadata.featuredLabel}</span>
              ) : null}
              {railHighlights.map((highlight) => (
                <span key={highlight} className="template-rail-card__capability">{highlight}</span>
              ))}
            </div>
            <div className="template-rail-card__footer">
              <div className="template-rail-card__hint">Replace canvas with template</div>
              <Button variant="ghost" size="sm" onClick={() => onUse?.(template.metadata.id)}>
                Use template
              </Button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'rail-list') {
    const supportLabel = [
      preset?.label,
      template.metadata.sceneCount ? `${template.metadata.sceneCount} scene${template.metadata.sceneCount === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ');
    return (
      <article
        className={`template-rail-list ${template.metadata.featured ? 'is-featured' : ''}`.trim()}
        data-preview-intent={previewIntent}
      >
        <div className="template-rail-list__media">
          <div className="template-rail-list__media-visual">
            {PreviewComponent
              ? <PreviewComponent />
              : template.metadata.thumbnail
                ? <img src={template.metadata.thumbnail} alt="" loading="lazy" />
                : (
                  <div className="template-rail-card__placeholder">
                    <span>{VERTICAL_LABELS[template.metadata.vertical]}</span>
                    <strong>{template.metadata.name}</strong>
                  </div>
                )}
          </div>
        </div>
        <div className="template-rail-list__main">
          <div className="template-rail-list__copy">
            <h3>{template.metadata.name}</h3>
            <p>{supportLabel || template.metadata.description}</p>
          </div>
          <div className="template-rail-list__actions">
            <Button variant="ghost" size="sm" onClick={() => onUse?.(template.metadata.id)}>
              Use
            </Button>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'featured') {
    return (
      <article className="template-card-featured">
        <div className="template-card-featured__preview">
          {PreviewComponent
            ? <PreviewComponent />
            : template.metadata.thumbnail
              ? <img src={template.metadata.thumbnail} alt="" loading="lazy" />
              : null}
        </div>
        <div className="template-card-featured__body">
          <div className="template-card-featured__eyebrow">
            <span className="pill pill-highlight">{template.metadata.featuredLabel ?? 'Featured starter'}</span>
            <span className="pill">{template.metadata.vertical}</span>
          </div>
          <h3>{template.metadata.name}</h3>
          <p>{template.metadata.description}</p>
          <div className="template-card-featured__facts">
            {highlights.map((highlight) => <span key={highlight} className="pill">{highlight}</span>)}
          </div>
          <div className="template-card-featured__actions">
            <Button variant="primary" size="md" onClick={() => onUse?.(template.metadata.id)}>
              Use featured starter
            </Button>
            {preset ? <span className="pill">{preset.label}</span> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`template-card ${template.metadata.featured ? 'is-featured' : ''}`.trim()}>
      <div className="template-card__media">
        {template.metadata.thumbnail
          ? <img src={template.metadata.thumbnail} alt="" />
          : (
            <div className="template-card__placeholder">
              <span>{template.metadata.vertical}</span>
              <strong>{template.metadata.name}</strong>
            </div>
          )}
      </div>
      <div className="template-card__body">
        <div className="template-card__badges">
          <span className="pill">{template.metadata.vertical}</span>
          {preset ? <span className="pill">{preset.label}</span> : null}
          {template.metadata.featuredLabel ? <span className="pill pill-highlight">{template.metadata.featuredLabel}</span> : <span className="pill">launch-ready</span>}
        </div>
        <h3>{template.metadata.name}</h3>
        <p>{template.metadata.description}</p>
        {template.metadata.recommendedFor ? (
          <small className="template-card__recommended-for">Best for {template.metadata.recommendedFor}.</small>
        ) : null}
        <div className="template-card__facts">
          {template.metadata.sceneCount ? <span>{template.metadata.sceneCount} scene{template.metadata.sceneCount === 1 ? '' : 's'}</span> : null}
          {highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}
        </div>
      </div>
      <div className="template-card__footer">
        <Button variant="primary" size="sm" onClick={() => onUse?.(template.metadata.id)}>
          Use template
        </Button>
      </div>
    </article>
  );
}
