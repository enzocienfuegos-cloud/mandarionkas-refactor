import { useEffect, useMemo, useRef } from 'react';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import {
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  type ShortcutDefinition,
  groupShortcutCatalogByCategory,
} from './shortcut-catalog';
import { formatShortcutTokens } from './use-keyboard-shortcuts';

type KeyboardShortcutsModalProps = {
  open: boolean;
  shortcuts: ShortcutDefinition[];
  onClose: () => void;
};

export function KeyboardShortcutsModal({ open, shortcuts, onClose }: KeyboardShortcutsModalProps): JSX.Element | null {
  const groupedShortcuts = useMemo(() => groupShortcutCatalogByCategory(shortcuts), [shortcuts]);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    cardRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="shortcut-modal-shell" role="dialog" aria-modal="true" aria-labelledby="shortcut-modal-title" onClick={onClose}>
      <div ref={cardRef} className="shortcut-modal-card" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className="shortcut-modal-header">
          <div className="shortcut-modal-copy">
            <div className="left-title">Keyboard shortcuts</div>
            <h2 id="shortcut-modal-title">Studio command palette</h2>
            <p>These shortcuts work across the editor when you are not typing in a field or dialog.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconBefore={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="shortcut-modal-grid">
          {SHORTCUT_CATEGORY_ORDER.map((category) => {
            const items = groupedShortcuts[category];
            if (!items.length) return null;
            return (
              <section key={category} className="shortcut-modal-group" aria-labelledby={`shortcut-group-${category}`}>
                <div className="shortcut-modal-group__head">
                  <h3 id={`shortcut-group-${category}`}>{SHORTCUT_CATEGORY_LABELS[category]}</h3>
                </div>
                <div className="shortcut-modal-group__body">
                  {items.map((entry) => (
                    <div key={`${category}-${entry.combo}`} className="shortcut-modal-row">
                      <span className="shortcut-modal-row__label">{entry.description}</span>
                      <span className="shortcut-kbd-stack" aria-label={entry.combo}>
                        {formatShortcutTokens(entry.combo).map((token, index) => (
                          <kbd key={`${entry.combo}-${index}`} className="shortcut-kbd">{token}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
