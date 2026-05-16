import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function PreviewLaunchModal({
  previewUrl,
  onClose,
  onOpenClientPreview,
  onCopyClientPreviewLink,
}: {
  previewUrl: string;
  onClose(): void;
  onOpenClientPreview(): void;
  onCopyClientPreviewLink(): void;
}): JSX.Element {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previewInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    getFocusableElements(cardRef.current)[0]?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusableElements(cardRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const previewPath = useMemo(() => {
    try {
      return new URL(previewUrl).hash || previewUrl;
    } catch {
      return previewUrl;
    }
  }, [previewUrl]);

  return createPortal(
    <div
      className="preview-launch-modal-shell"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-launch-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={cardRef} className="preview-launch-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="preview-launch-modal-header">
          <div className="preview-launch-modal-copy">
            <span className="preview-launch-modal-eyebrow">Share for review</span>
            <h2 id="preview-launch-modal-title">Public preview link</h2>
            <p>Open the standalone client review view in a new tab, or copy the link to share via email or chat.</p>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            label="Close preview launcher"
            icon={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          />
        </div>

        <div className="preview-launch-modal-actions">
          <Button
            variant="primary"
            size="lg"
            iconBefore={<StudioIcon icon={StudioIcons.externalLink} size={14} />}
            onClick={onOpenClientPreview}
          >
            Open public preview
          </Button>
          <Button
            variant="ghost"
            size="lg"
            iconBefore={<StudioIcon icon={StudioIcons.copy} size={14} />}
            onClick={onCopyClientPreviewLink}
          >
            Copy link
          </Button>
        </div>

        <div className="preview-launch-modal-link">
          <label htmlFor="preview-launch-link">Public route</label>
          <div className="preview-launch-modal-link__row">
            <input
              id="preview-launch-link"
              ref={previewInputRef}
              value={previewPath}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                previewInputRef.current?.focus();
                previewInputRef.current?.select();
              }}
            >
              Select
            </Button>
          </div>
        </div>

        <div className="preview-launch-modal-hint">
          <small>To preview inline while editing, use the Play button on the timeline below.</small>
        </div>
      </div>
    </div>,
    document.body,
  );
}
