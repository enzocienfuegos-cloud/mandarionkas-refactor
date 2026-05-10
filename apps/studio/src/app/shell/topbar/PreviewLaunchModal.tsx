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
  onOpenCanvasPreview,
  onOpenClientPreview,
  onCopyClientPreviewLink,
}: {
  previewUrl: string;
  onClose(): void;
  onOpenCanvasPreview(): void;
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
            <span className="preview-launch-modal-eyebrow">Preview flow</span>
            <h2 id="preview-launch-modal-title">Review this creative</h2>
            <p>Open the in-editor canvas preview or launch the public client review experience in a new tab.</p>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            label="Close preview launcher"
            icon={<StudioIcon icon={StudioIcons.x} size={14} />}
            onClick={onClose}
          />
        </div>

        <div className="preview-launch-modal-grid">
          <section className="preview-launch-modal-panel">
            <span className="preview-launch-modal-panel__label">Inside Studio</span>
            <strong>Canvas preview</strong>
            <p>Stay in the editor, hide editing chrome, and play the current scene in place.</p>
            <Button
              variant="secondary"
              size="lg"
              iconBefore={<StudioIcon icon={StudioIcons.play} size={14} />}
              onClick={onOpenCanvasPreview}
            >
              Open canvas preview
            </Button>
          </section>

          <section className="preview-launch-modal-panel preview-launch-modal-panel--accent">
            <span className="preview-launch-modal-panel__label">For client review</span>
            <strong>Public preview</strong>
            <p>Open the standalone review view with comments, scene navigation, and the white MandaRion header.</p>
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
          </section>
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
      </div>
    </div>,
    document.body,
  );
}
