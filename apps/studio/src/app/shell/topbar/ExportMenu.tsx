import { useEffect, useRef, useState } from 'react';
import { EXPORT_CHANNELS, channelLabel, type ExportChannel } from './export-channels';

type ExportMenuProps = {
  currentChannel: ExportChannel;
  isExporting: boolean;
  onExportAs(channel: ExportChannel): void;
};

export function ExportMenu({ currentChannel, isExporting, onExportAs }: ExportMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <button
        type="button"
        className="primary compact-action"
        disabled={isExporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Export ${channelLabel(currentChannel)}`}
        onClick={() => setOpen((value) => !value)}
      >
        {isExporting ? 'Exporting…' : 'Export ▾'}
      </button>

      {open ? (
        <div className="top-export-popover" role="menu" aria-label="Export format">
          {EXPORT_CHANNELS.map((channel) => (
            <button
              key={channel.value}
              type="button"
              role="menuitem"
              className={`ghost export-menu-item${channel.value === currentChannel ? ' is-active' : ''}`}
              onClick={() => {
                setOpen(false);
                onExportAs(channel.value);
              }}
            >
              <span>{channel.label}</span>
              {channel.value === currentChannel ? (
                <span className="export-menu-check" aria-hidden="true">✓</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
