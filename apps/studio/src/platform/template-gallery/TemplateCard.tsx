import type { StudioTemplate } from '../../templates/library/types';
import { Button } from '../../shared/ui/Button';

export function TemplateCard({
  template,
  onUse,
}: {
  template: StudioTemplate;
  onUse?: (templateId: string) => void;
}): JSX.Element {
  return (
    <article className="template-card">
      <div className="template-card__media">
        {template.metadata.thumbnail ? <img src={template.metadata.thumbnail} alt="" /> : <div className="template-card__placeholder">{template.metadata.vertical}</div>}
      </div>
      <div className="template-card__body">
        <span className="pill">{template.metadata.vertical}</span>
        <h3>{template.metadata.name}</h3>
        <p>{template.metadata.description}</p>
      </div>
      <div className="template-card__footer">
        <Button variant="ghost" size="sm" onClick={() => onUse?.(template.metadata.id)}>
          Use template
        </Button>
      </div>
    </article>
  );
}
