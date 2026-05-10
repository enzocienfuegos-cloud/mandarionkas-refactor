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

  return (
    <article className="template-card">
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
          <span className="pill">launch-ready</span>
        </div>
        <h3>{template.metadata.name}</h3>
        <p>{template.metadata.description}</p>
      </div>
      <div className="template-card__footer">
        <Button variant="primary" size="sm" onClick={() => onUse?.(template.metadata.id)}>
          Use template
        </Button>
      </div>
    </article>
  );
}
