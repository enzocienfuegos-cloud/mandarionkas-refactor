import { useEffect, useRef, useState } from 'react';
import { EXPORT_CHANNELS, channelLabel, type ExportChannel } from './export-channels';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
import { Button } from '../../../shared/ui/Button';

type ExportMenuProps = {
  currentChannel: ExportChannel;
  isExporting: boolean;
  publishLabel: string;
  onExportAs(channel: ExportChannel): void;
  onShare(): void;
  onCopyPreviewLink(): void;
  onPublish(): void;
};

export function ExportMenu({
  currentChannel,
  isExporting,
  publishLabel,
  onExportAs,
  onShare,
  onCopyPreviewLink,
  onPublish,
}: ExportMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const alternateChannels = EXPORT_CHANNELS.filter((channel) => channel.value !== currentChannel);

  useEffect(() => {
    if (!open) return undefined;

    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    function onMouseDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="top-export-menu">
      <Button
        variant="primary"
        size="sm"
        className="top-export-button"
        disabled={isExporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Export ${channelLabel(currentChannel)}`}
        onClick={() => setOpen((value) => !value)}
      >
        {isExporting ? 'Exporting…' : <>
          <StudioIcon icon={StudioIcons.download} size={14} />
          Export
          <StudioIcon icon={StudioIcons.chevronDown} size={14} />
        </>}
      </Button>

      {open ? (
        <div className="top-export-popover" role="menu" aria-label="Export format">
          <div className="export-menu-section-label">Export</div>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            className="export-menu-item export-menu-item--primary"
            onClick={() => {
              setOpen(false);
              onExportAs(currentChannel);
            }}
          >
            <span>Export ZIP ({channelLabel(currentChannel)})</span>
            <span className="export-menu-shortcut">⌘E</span>
          </Button>
          {alternateChannels.map((channel) => (
            <Button
              key={channel.value}
              variant="ghost"
              size="sm"
              role="menuitem"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                onExportAs(channel.value);
              }}
            >
              <span>Export as {channel.label}</span>
              <span className="export-menu-check" aria-hidden="true"><StudioIcon icon={StudioIcons.chevronRight} size={14} /></span>
            </Button>
          ))}

          <div className="export-menu-divider" aria-hidden="true" />
          <div className="export-menu-section-label">Share</div>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            className="export-menu-item"
            onClick={() => {
              setOpen(false);
              onShare();
            }}
          >
            <span>Build share package</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            className="export-menu-item"
            onClick={() => {
              setOpen(false);
              onCopyPreviewLink();
            }}
          >
            <span>Copy preview link</span>
          </Button>

          <div className="export-menu-divider" aria-hidden="true" />
          <div className="export-menu-section-label">Publish</div>
          <Button
            variant="ghost"
            size="sm"
            role="menuitem"
            className="export-menu-item"
            onClick={() => {
              setOpen(false);
              onPublish();
            }}
          >
            <span>{publishLabel}</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
