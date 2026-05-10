import { useEffect, useMemo, useState } from 'react';
import { CANVAS_PRESETS } from '../../domain/document/canvas-presets';
import { useDocumentActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';
import { Button } from '../../shared/ui/Button';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';

export function CanvasVariantStrip(): JSX.Element {
  const { canvasVariants, activeCanvasVariantId } = useStudioStore((state) => ({
    canvasVariants: state.document.canvasVariants,
    activeCanvasVariantId: state.document.activeCanvasVariantId,
  }));
  const { addCanvasVariant, selectCanvasVariant, renameCanvasVariant, duplicateCanvasVariant, deleteCanvasVariant, setMasterCanvasVariant } = useDocumentActions();
  const addablePresets = useMemo(() => CANVAS_PRESETS.filter((preset) => preset.id !== 'custom' && !canvasVariants.some((variant) => variant.width === preset.width && variant.height === preset.height)), [canvasVariants]);
  const [draftPresetId, setDraftPresetId] = useState(addablePresets[0]?.id ?? '');
  const activeVariant = canvasVariants.find((variant) => variant.id === activeCanvasVariantId) ?? canvasVariants[0];

  useEffect(() => {
    if (!addablePresets.length) {
      setDraftPresetId('');
      return;
    }
    if (!addablePresets.some((preset) => preset.id === draftPresetId)) {
      setDraftPresetId(addablePresets[0]?.id ?? '');
    }
  }, [addablePresets, draftPresetId]);

  function handleRenameVariant(): void {
    if (!activeVariant || typeof window === 'undefined') return;
    const nextLabel = window.prompt('Rename size', activeVariant.label)?.trim();
    if (nextLabel && nextLabel !== activeVariant.label) renameCanvasVariant(activeVariant.id, nextLabel);
  }

  function handleDeleteVariant(): void {
    if (!activeVariant || activeVariant.isMaster || canvasVariants.length <= 1 || typeof window === 'undefined') return;
    const confirmed = window.confirm(`Delete ${activeVariant.label}? Local overrides for this size will be removed.`);
    if (confirmed) deleteCanvasVariant(activeVariant.id);
  }

  return (
    <section className="canvas-variant-strip" aria-label="Canvas size set">
      <div className="canvas-variant-strip__list" role="tablist" aria-label="Canvas variants">
        {canvasVariants.map((variant) => {
          const active = variant.id === activeCanvasVariantId;
          return (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`canvas-variant-chip${active ? ' is-active' : ''}${variant.isMaster ? ' is-master' : ''}`}
              onClick={() => selectCanvasVariant(variant.id)}
            >
              {variant.isMaster ? (
                <span className="canvas-variant-chip__master" aria-hidden="true">
                  <StudioIcon icon={StudioIcons.star} size={12} />
                </span>
              ) : null}
              <span className="canvas-variant-chip__label">{variant.label}</span>
              {variant.isMaster ? <span className="canvas-variant-chip__badge">master</span> : null}
            </button>
          );
        })}
      </div>

      <div className="canvas-variant-strip__actions">
        {activeVariant ? (
          <div className="canvas-variant-strip__variant-actions">
            <Button variant="ghost" size="sm" onClick={handleRenameVariant}>
              Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => duplicateCanvasVariant(activeVariant.id)}>
              Duplicate
            </Button>
            {!activeVariant.isMaster ? (
              <Button variant="ghost" size="sm" onClick={() => setMasterCanvasVariant(activeVariant.id)}>
                Set as master
              </Button>
            ) : null}
            {!activeVariant.isMaster && canvasVariants.length > 1 ? (
              <Button variant="ghost" size="sm" className="danger-action" onClick={handleDeleteVariant}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
        {addablePresets.length ? (
          <>
            <label className="canvas-variant-strip__add-shell">
              <span className="canvas-variant-strip__add-label">Add size</span>
              <select value={draftPresetId} onChange={(event) => setDraftPresetId(event.target.value)} aria-label="Canvas size preset to add">
                {addablePresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.width}×{preset.height}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              size="sm"
              iconBefore={<StudioIcon icon={StudioIcons.plus} size={14} />}
              onClick={() => draftPresetId && addCanvasVariant(draftPresetId)}
            >
              Add size
            </Button>
          </>
        ) : (
          <span className="canvas-variant-strip__hint">All common sizes already added</span>
        )}
      </div>
    </section>
  );
}
