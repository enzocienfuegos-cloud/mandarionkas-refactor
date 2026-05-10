import type { StudioTemplate } from '../../templates/library/types';
import { Button } from '../../shared/ui/Button';
import { getCanvasPresetById } from '../../domain/document/canvas-presets';

export function TemplateCard({
  template,
  onUse,
}: {
  template: StudioTemplate;
  onUse?: (templateId: string) => void;
}): JSX.Element {
  const preset = template.metadata.canvasPresetId ? getCanvasPresetById(template.metadata.canvasPresetId) : null;
  const highlights = template.metadata.moduleHighlights?.slice(0, 2) ?? [];

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
