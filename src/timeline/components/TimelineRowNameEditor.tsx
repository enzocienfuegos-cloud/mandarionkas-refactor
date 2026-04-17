import { useEffect, useState } from 'react';

export function TimelineRowNameEditor({ widgetId, value, onCommit }: { widgetId: string; value: string; onCommit: (widgetId: string, nextName: string) => void }): JSX.Element {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, widgetId]);

  const trimmed = draft.trim();

  return (
    <input
      className="timeline-row-name-input"
      value={draft}
      aria-label={`Rename ${value}`}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(widgetId, trimmed || value);
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const nextName = trimmed || value;
        setDraft(nextName);
        if (nextName !== value) onCommit(widgetId, nextName);
      }}
    />
  );
}
