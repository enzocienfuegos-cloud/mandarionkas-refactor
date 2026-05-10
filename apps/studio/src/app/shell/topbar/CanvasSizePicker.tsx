import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_PRESETS, type CanvasPreset } from '../../../domain/document/canvas-presets';
import { IconButton } from '../../../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';

type CanvasSizePickerProps = {
  presetId: string;
  width: number;
  height: number;
  onPresetChange(presetId: string): void;
  onCustomSize(width: number, height: number): void;
};

const PRESET_CATEGORY_LABELS: Record<CanvasPreset['category'], string> = {
  display: 'Standard',
  story: 'Mobile / Social',
  custom: 'Custom',
};

function formatCanvasLabel(preset: CanvasPreset | undefined, width: number, height: number): string {
  if (!preset || preset.id === 'custom') return `${width}×${height}`;
  return preset.label;
}

export function CanvasSizePicker({
  presetId,
  width,
  height,
  onPresetChange,
  onCustomSize,
}: CanvasSizePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [draftWidth, setDraftWidth] = useState(String(width));
  const [draftHeight, setDraftHeight] = useState(String(height));
  const shellRef = useRef<HTMLDivElement | null>(null);

  const activePreset = useMemo(() => CANVAS_PRESETS.find((item) => item.id === presetId), [presetId]);
  const groupedPresets = useMemo(() => {
    return CANVAS_PRESETS.reduce<Record<CanvasPreset['category'], CanvasPreset[]>>((acc, preset) => {
      acc[preset.category].push(preset);
      return acc;
    }, { display: [], story: [], custom: [] });
  }, []);

  useEffect(() => {
    setDraftWidth(String(width));
    setDraftHeight(String(height));
  }, [width, height]);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }

    function handleMouseDown(event: MouseEvent): void {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open]);

  function applyCustomSize(): void {
    const nextWidth = Math.max(1, Number(draftWidth) || width);
    const nextHeight = Math.max(1, Number(draftHeight) || height);
    onPresetChange('custom');
    onCustomSize(nextWidth, nextHeight);
  }

  return (
    <div ref={shellRef} className="top-size-picker">
      <button
        type="button"
        className="top-size-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="top-select-shell__icon" aria-hidden="true">
          <StudioIcon icon={StudioIcons.boxes} size={14} />
        </span>
        <span className="top-size-picker__label">{formatCanvasLabel(activePreset, width, height)}</span>
        <StudioIcon icon={StudioIcons.chevronDown} size={14} />
      </button>

      {open ? (
        <div className="top-size-picker__popover panel" role="dialog" aria-label="Canvas size picker">
          {(['display', 'story'] as const).map((category) => (
            <div key={category} className="top-size-picker__section">
              <div className="top-size-picker__section-label">{PRESET_CATEGORY_LABELS[category]}</div>
              <div className="top-size-picker__options">
                {groupedPresets[category].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`top-size-picker__option ${preset.id === presetId ? 'is-active' : ''}`.trim()}
                    onClick={() => {
                      onPresetChange(preset.id);
                      setOpen(false);
                    }}
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.width}×{preset.height}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="top-size-picker__section">
            <div className="top-size-picker__section-label">{PRESET_CATEGORY_LABELS.custom}</div>
            <div className="top-size-picker__custom">
              <label>
                <span>Width</span>
                <input
                  aria-label="Custom canvas width"
                  type="number"
                  min={1}
                  value={draftWidth}
                  onChange={(event) => setDraftWidth(event.target.value)}
                />
              </label>
              <label>
                <span>Height</span>
                <input
                  aria-label="Custom canvas height"
                  type="number"
                  min={1}
                  value={draftHeight}
                  onChange={(event) => setDraftHeight(event.target.value)}
                />
              </label>
              <IconButton
                variant="ghost"
                size="sm"
                label="Apply custom size"
                tooltipPlacement="bottom"
                icon={<StudioIcon icon={StudioIcons.check} size={14} />}
                onClick={() => {
                  applyCustomSize();
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
