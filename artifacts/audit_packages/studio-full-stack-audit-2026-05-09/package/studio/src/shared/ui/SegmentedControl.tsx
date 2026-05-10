/**
 * SegmentedControl — for picking one option from a small set that filters or
 * narrows existing content in place. Use when the choice does not reveal a
 * different surface, but simply changes what is displayed in the current one.
 *
 * Example: Widget category filter (All / Content / Media / Interactive).
 *
 * For switching between distinct panels of UI, prefer Tabs.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={`segmented-control ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`segmented-control__option ${active ? 'is-active' : ''}`.trim()}
            onClick={() => onChange(option.id)}
          >
            <span>{option.label}</span>
            {typeof option.count === 'number' ? <span className="segmented-control__count">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
