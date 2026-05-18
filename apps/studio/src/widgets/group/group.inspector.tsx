import { useMemo } from 'react';
import type { SceneNode, WidgetNode } from '../../domain/document/types';
import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { AnimationTrigger } from '../../motion/animation-engine/events';
import { Button } from '../../shared/ui/Button';
import { InspectorRangeField } from '../../shared/ui/InspectorRangeField';
import { getScratchActivationMode } from './group-scratch-activation';
import {
  DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD,
  generateScratchMilestoneId,
  MAX_SCRATCH_MILESTONES,
  type ScratchMilestone,
} from './group-scratch-constants';
import { getScratchRevealTargetId, getScratchRevealTargetMode, isRevealTargetCandidate } from './group-reveal-target';

export function GroupInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const scratchEnabled = Boolean(widget.props.scratchEnabled);
  const scenes = useStudioStore((state) => state.document.scenes);
  const widgetsById = useStudioStore((state) => state.document.widgets);
  const revealTargetMode = getScratchRevealTargetMode(widget);
  const revealTargetId = getScratchRevealTargetId(widget);
  const scratchActivationMode = getScratchActivationMode(widget);
  const milestones: ScratchMilestone[] = Array.isArray(widget.props.scratchMilestones)
    ? (widget.props.scratchMilestones as ScratchMilestone[])
    : [];
  const sceneOptions = useMemo(
    () => [...scenes].sort((left, right) => left.order - right.order),
    [scenes],
  );
  const widgetOptions = useMemo(
    () => Object.values(widgetsById)
      .filter((candidate) => isRevealTargetCandidate(widget, candidate, widgetsById))
      .sort((left, right) => left.zIndex - right.zIndex),
    [widget, widgetsById],
  );
  const selectedSceneTargetId = sceneOptions.some((scene) => scene.id === revealTargetId)
    ? revealTargetId
    : widget.sceneId;

  const updateRevealTargetMode = (nextMode: string) => {
    if (nextMode === 'scene') {
      const fallbackSceneId = sceneOptions.some((scene) => scene.id === revealTargetId)
        ? revealTargetId
        : widget.sceneId || sceneOptions[0]?.id || '';
      widgetActions.updateWidgetProps(widget.id, {
        revealTargetMode: 'scene',
        revealTargetId: fallbackSceneId,
      });
      return;
    }
    if (nextMode === 'widget') {
      const fallbackWidgetId = widgetOptions.some((candidate) => candidate.id === revealTargetId)
        ? revealTargetId
        : widgetOptions[0]?.id ?? '';
      widgetActions.updateWidgetProps(widget.id, {
        revealTargetMode: 'widget',
        revealTargetId: fallbackWidgetId,
      });
      return;
    }
    widgetActions.updateWidgetProps(widget.id, {
      revealTargetMode: 'auto',
      revealTargetId: '',
    });
  };

  const renderSceneLabel = (scene: SceneNode): string => {
    if (scene.id === widget.sceneId) return `${scene.name} (Current scene)`;
    return scene.name;
  };

  const renderWidgetLabel = (candidate: WidgetNode): string => {
    const kind = candidate.type === 'group' ? 'Group' : 'Layer';
    return `${candidate.name} · ${kind}`;
  };

  const addMilestone = () => {
    if (milestones.length >= MAX_SCRATCH_MILESTONES) return;
    const usedThresholds = new Set(milestones.map((milestone) => milestone.thresholdPercent));
    const suggested = [25, 50, 75].find((threshold) => !usedThresholds.has(threshold)) ?? 50;
    const next: ScratchMilestone = {
      id: generateScratchMilestoneId(),
      thresholdPercent: suggested,
      emitTrigger: 'reveal',
    };
    widgetActions.updateWidgetProps(widget.id, { scratchMilestones: [...milestones, next] });
  };

  const updateMilestone = (milestoneId: string, patch: Partial<ScratchMilestone>) => {
    widgetActions.updateWidgetProps(widget.id, {
      scratchMilestones: milestones.map((milestone) => (
        milestone.id === milestoneId ? { ...milestone, ...patch } : milestone
      )),
    });
  };

  const removeMilestone = (milestoneId: string) => {
    widgetActions.updateWidgetProps(widget.id, {
      scratchMilestones: milestones.filter((milestone) => milestone.id !== milestoneId),
    });
  };

  return (
    <section className="section section-premium">
      <h3>Group</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <InspectorRangeField
          label="Child cascade"
          min={0}
          max={1000}
          step={25}
          unit="ms"
          value={Number(widget.props.childCascadeDelayMs ?? 0)}
          onChange={(childCascadeDelayMs) => widgetActions.updateWidgetProps(widget.id, { childCascadeDelayMs })}
          helpText="Adds stagger between child layers when they inherit the group motion."
        />
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={scratchEnabled}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchEnabled: event.target.checked })}
          />
          Enable scratch cover from grouped layers
        </label>
        {scratchEnabled ? (
          <>
            <div>
              <label>Reveal target</label>
              <select value={revealTargetMode} onChange={(event) => updateRevealTargetMode(event.target.value)}>
                <option value="auto">Auto (layers behind)</option>
                <option value="widget">Layer or group</option>
                <option value="scene">Scene</option>
              </select>
            </div>
            {revealTargetMode === 'widget' ? (
              <div>
                <label>Target layer or group</label>
                <select
                  value={revealTargetId}
                  onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealTargetId: event.target.value })}
                >
                  {!widgetOptions.length ? <option value="">No eligible layers or groups</option> : null}
                  {widgetOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {renderWidgetLabel(candidate)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {revealTargetMode === 'scene' ? (
              <div>
                <label>Target scene</label>
                <select
                  value={selectedSceneTargetId}
                  onChange={(event) => widgetActions.updateWidgetProps(widget.id, { revealTargetId: event.target.value })}
                >
                  {sceneOptions.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {renderSceneLabel(scene)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <InspectorRangeField
              label="Cover blur"
              min={0}
              max={20}
              step={1}
              unit="px"
              value={Number(widget.props.coverBlur ?? 0)}
              onChange={(coverBlur) => widgetActions.updateWidgetProps(widget.id, { coverBlur })}
            />
            <InspectorRangeField
              label="Scratch radius"
              min={8}
              max={80}
              step={1}
              unit="px"
              value={Number(widget.props.scratchRadius ?? 22)}
              onChange={(scratchRadius) => widgetActions.updateWidgetProps(widget.id, { scratchRadius })}
              helpText="Larger radius makes each swipe clear more cover."
            />
            <InspectorRangeField
              label="Auto reveal"
              min={0}
              max={100}
              step={1}
              unit="%"
              value={Number(widget.props.autoRevealThresholdPercent ?? DEFAULT_SCRATCH_AUTO_REVEAL_THRESHOLD)}
              onChange={(autoRevealThresholdPercent) => widgetActions.updateWidgetProps(widget.id, { autoRevealThresholdPercent })}
              helpText="Set 0% to disable automatic completion."
            />
            <InspectorRangeField
              label="Activation delay"
              min={0}
              max={5000}
              step={50}
              unit="ms"
              value={Number(widget.props.scratchActivationDelayMs ?? 0)}
              onChange={(scratchActivationDelayMs) => widgetActions.updateWidgetProps(widget.id, { scratchActivationDelayMs })}
              helpText={scratchActivationMode === 'after-motion'
                ? 'Starts after child/group animations settle, plus this delay.'
                : 'Exact time after the group timeline starts before the scratch cover becomes interactive.'}
            />
            <div>
              <label>Activation timing</label>
              <select
                value={scratchActivationMode}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchActivationMode: event.target.value })}
              >
                <option value="delay">Use exact delay</option>
                <option value="after-motion">After child motion + delay</option>
              </select>
            </div>
            <div className="field-stack">
              <strong>Milestones intermedios</strong>
              <small className="muted">Dispará triggers al cruzar % de rascado sin completar. Útil para animar capas escalonadas.</small>
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="fields-grid">
                  <div>
                    <label>{`Milestone ${index + 1} (%)`}</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={milestone.thresholdPercent}
                      onChange={(event) => updateMilestone(milestone.id, {
                        thresholdPercent: Number(event.target.value),
                      })}
                    />
                  </div>
                  <div>
                    <label>Trigger emitido</label>
                    <select
                      value={milestone.emitTrigger}
                      onChange={(event) => updateMilestone(milestone.id, {
                        emitTrigger: event.target.value as AnimationTrigger,
                      })}
                    >
                      <option value="reveal">reveal</option>
                      <option value="scratch-complete">scratch-complete</option>
                      <option value="completion">completion</option>
                      <option value="game-state">game-state</option>
                    </select>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => removeMilestone(milestone.id)}>Remover</Button>
                </div>
              ))}
              <Button onClick={addMilestone} disabled={milestones.length >= MAX_SCRATCH_MILESTONES}>
                {`Agregar milestone (${milestones.length}/${MAX_SCRATCH_MILESTONES})`}
              </Button>
            </div>
            <small className="muted">
              The grouped child layers become the scratchable cover. Reveal target can stay automatic or point explicitly to a layer, group, or scene.
            </small>
          </>
        ) : null}
      </div>
    </section>
  );
}
