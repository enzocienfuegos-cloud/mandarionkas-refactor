import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Button } from '../../shared/ui/Button';
import { badgeStateFromInheritance, useWidgetInheritance, type InheritanceBadgeState } from '../use-widget-inheritance';

type PositionInputField =
  | { label: string; kind: 'frame'; key: 'x' | 'y' | 'width' | 'height' | 'rotation' }
  | { label: string; kind: 'style'; key: 'opacity' };

export function PositionSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetFrame, updateWidgetStyle, updateWidgetProps } = useWidgetActions();
  const {
    baseWidget,
    inheritedSharedBaseWidget,
    isMasterVariant,
    isSharedLayerBase,
    isSharedLayerClone,
    localVariantFrameOverrideKeys,
    localVariantStyleOverrideKeys,
    localVariantPropsOverrideKeys,
    localSceneFrameOverrideKeys,
    localSceneStyleOverrideKeys,
    localScenePropsOverrideKeys,
  } = useWidgetInheritance(widget);
  const lockAspectRatio = Boolean(widget.props.lockAspectRatio);
  const aspectRatio = widget.frame.height > 0 ? widget.frame.width / widget.frame.height : 1;
  const resetTarget = isSharedLayerClone ? inheritedSharedBaseWidget : baseWidget;
  const hasFrameOverride = localVariantFrameOverrideKeys.size > 0 || localSceneFrameOverrideKeys.size > 0;
  const hasStyleOverride = localVariantStyleOverrideKeys.size > 0 || localSceneStyleOverrideKeys.size > 0;
  const hasPropsOverride = localVariantPropsOverrideKeys.size > 0 || localScenePropsOverrideKeys.size > 0;
  const fields: PositionInputField[] = [
    { label: 'X', kind: 'frame', key: 'x' },
    { label: 'Y', kind: 'frame', key: 'y' },
    { label: 'W', kind: 'frame', key: 'width' },
    { label: 'H', kind: 'frame', key: 'height' },
    { label: 'Opacity', kind: 'style', key: 'opacity' },
    { label: 'Rotation', kind: 'frame', key: 'rotation' },
  ];

  function renderBadge(state: InheritanceBadgeState): JSX.Element | null {
    if (state === 'none') return null;
    if (state === 'local') return <span className="inspector-override-badge is-local">✱</span>;
    if (state === 'shared') return <span className="inspector-override-badge is-shared">S</span>;
    return <span className="inspector-override-badge is-master">M</span>;
  }

  function updateFrameValue(key: 'x' | 'y' | 'width' | 'height' | 'rotation', rawValue: string): void {
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;

    if (lockAspectRatio && (key === 'width' || key === 'height')) {
      if (key === 'width') {
        const width = Math.max(40, nextValue);
        updateWidgetFrame(widget.id, {
          width,
          height: Math.max(30, Math.round(width / Math.max(aspectRatio, 0.0001))),
        });
        return;
      }

      const height = Math.max(30, nextValue);
      updateWidgetFrame(widget.id, {
        height,
        width: Math.max(40, Math.round(height * Math.max(aspectRatio, 0.0001))),
      });
      return;
    }

    updateWidgetFrame(widget.id, { [key]: nextValue });
  }

  function updateOpacity(rawValue: string): void {
    const nextOpacity = Number(rawValue);
    if (!Number.isFinite(nextOpacity)) return;
    updateWidgetStyle(widget.id, { opacity: Math.max(0, Math.min(1, nextOpacity / 100)) });
  }

  function resetFrameToMaster(): void {
    if (!resetTarget) return;
    updateWidgetFrame(widget.id, {
      x: resetTarget.frame.x,
      y: resetTarget.frame.y,
      width: resetTarget.frame.width,
      height: resetTarget.frame.height,
      rotation: resetTarget.frame.rotation,
    });
  }

  function resetSectionToMaster(): void {
    if (!resetTarget) return;
    if (hasFrameOverride) resetFrameToMaster();
    if (hasStyleOverride) updateWidgetStyle(widget.id, { opacity: Number(resetTarget.style.opacity ?? 1) });
    if (hasPropsOverride) updateWidgetProps(widget.id, { lockAspectRatio: resetTarget.props.lockAspectRatio });
  }

  return (
    <section className="section section-premium">
      <div className="section-heading-row">
        <div>
          <h3>Position and size</h3>
          {isSharedLayerClone ? (
            <small className="muted">
              Values inherit from the shared base layer unless this scene overrides them locally.
            </small>
          ) : isSharedLayerBase ? (
            <small className="muted">
              Edits here propagate to every scene using this shared layer unless a scene has its own local exception.
            </small>
          ) : !isMasterVariant ? (
            <small className="muted">
              Values inherit from the master size unless this size has a local override.
            </small>
          ) : null}
        </div>
        {(isSharedLayerClone || !isMasterVariant) && (hasFrameOverride || hasStyleOverride || hasPropsOverride) ? (
          <Button variant="ghost" size="sm" className="subtle-action" onClick={resetSectionToMaster}>
            {isSharedLayerClone ? 'Reset scene override' : 'Reset to master'}
          </Button>
        ) : null}
      </div>
      <div className="fields-grid fields-grid--triple">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="inspector-field-label">
              <span>{field.label}</span>
              {field.kind === 'frame'
                ? renderBadge(badgeStateFromInheritance({
                    sceneLocal: localSceneFrameOverrideKeys.has(field.key),
                    variantLocal: localVariantFrameOverrideKeys.has(field.key),
                    sharedClone: isSharedLayerClone,
                    isMasterVariant,
                  }))
                : null}
              {field.kind === 'style'
                ? renderBadge(badgeStateFromInheritance({
                    sceneLocal: localSceneStyleOverrideKeys.has(field.key),
                    variantLocal: localVariantStyleOverrideKeys.has(field.key),
                    sharedClone: isSharedLayerClone,
                    isMasterVariant,
                  }))
                : null}
            </label>
            {field.kind === 'style' ? (
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(Number(widget.style.opacity ?? 1) * 100)}
                onChange={(event) => updateOpacity(event.target.value)}
              />
            ) : (
              <input
                type="number"
                value={Math.round(widget.frame[field.key])}
                onChange={(event) => updateFrameValue(field.key, event.target.value)}
              />
            )}
          </div>
        ))}
      </div>
      <label className="checkbox-row field-toggle-row">
        {renderBadge(badgeStateFromInheritance({
          sceneLocal: localScenePropsOverrideKeys.has('lockAspectRatio'),
          variantLocal: localVariantPropsOverrideKeys.has('lockAspectRatio'),
          sharedClone: isSharedLayerClone,
          isMasterVariant,
        }))}
        <input
          type="checkbox"
          checked={lockAspectRatio}
          onChange={(event) => updateWidgetProps(widget.id, { lockAspectRatio: event.target.checked })}
        />
        Lock aspect ratio
      </label>
    </section>
  );
}
