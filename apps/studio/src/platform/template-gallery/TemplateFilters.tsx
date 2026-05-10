import type { StudioTemplateVertical } from '../../templates/library/types';

export function TemplateFilters({
  activeVertical,
  verticals,
  onChange,
}: {
  activeVertical: 'all' | StudioTemplateVertical;
  verticals: StudioTemplateVertical[];
  onChange: (vertical: 'all' | StudioTemplateVertical) => void;
}): JSX.Element {
  return (
    <div className="template-filters" role="tablist" aria-label="Template vertical filters">
      <button type="button" className={`template-filter-chip ${activeVertical === 'all' ? 'is-active' : ''}`.trim()} onClick={() => onChange('all')}>
        All
      </button>
      {verticals.map((vertical) => (
        <button
          key={vertical}
          type="button"
          className={`template-filter-chip ${activeVertical === vertical ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(vertical)}
        >
          {vertical}
        </button>
      ))}
    </div>
  );
}
