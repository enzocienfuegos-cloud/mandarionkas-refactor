import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';
import type { EndCardTriggerConfig } from '../../../domain/document/types';

const DEFAULT_TRIGGER: EndCardTriggerConfig = {
  enabled: false,
  targetSceneId: '',
  afterSceneCount: 0,
  afterSeconds: 0,
  delayMs: 0,
};

export function EndCardTriggerSection(): JSX.Element {
  const { document } = useDocumentInspectorContext();
  const { updateEndCardTrigger } = useDocumentActions();

  const trigger: EndCardTriggerConfig = document.canvas.endCardTrigger ?? DEFAULT_TRIGGER;
  const scenes = document.scenes;

  const update = (patch: Partial<EndCardTriggerConfig>) => {
    updateEndCardTrigger(patch);
  };

  const neitherConditionSet = trigger.enabled && trigger.afterSceneCount === 0 && trigger.afterSeconds === 0;

  return (
    <section className="section section-premium">
      <h3>End card trigger</h3>
      <div className="field-stack">
        <small className="muted">
          Automatically navigate to a target scene after the user has visited N scenes
          or N seconds have elapsed — whichever condition fires first.
        </small>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={trigger.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          Enable end card trigger
        </label>

        {trigger.enabled ? (
          <>
            <div>
              <label>Target scene</label>
              <select
                value={trigger.targetSceneId}
                onChange={(event) => update({ targetSceneId: event.target.value })}
              >
                <option value="">— pick a scene —</option>
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fields-grid">
              <div>
                <label title="Navigate after this many distinct scenes have been visited. Set to 0 to disable this condition.">
                  After scenes visited
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={trigger.afterSceneCount}
                  onChange={(event) =>
                    update({ afterSceneCount: Math.max(0, Math.round(Number(event.target.value))) })
                  }
                  placeholder="0 = off"
                />
              </div>
              <div>
                <label title="Navigate after this many seconds of elapsed time. Set to 0 to disable this condition.">
                  After seconds
                </label>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  step={0.5}
                  value={trigger.afterSeconds}
                  onChange={(event) =>
                    update({ afterSeconds: Math.max(0, Number(event.target.value)) })
                  }
                  placeholder="0 = off"
                />
              </div>
            </div>

            <div>
              <label title="Milliseconds to wait after the condition fires before navigating. Useful to let a scene animation finish.">
                Delay before navigating (ms)
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                step={100}
                value={trigger.delayMs}
                onChange={(event) =>
                  update({ delayMs: Math.max(0, Math.round(Number(event.target.value))) })
                }
                placeholder="0 = immediate"
              />
            </div>

            {neitherConditionSet ? (
              <small className="muted" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                Set at least one condition (scenes visited or seconds) for the trigger to fire.
              </small>
            ) : null}

            {trigger.targetSceneId === '' && (trigger.afterSceneCount > 0 || trigger.afterSeconds > 0) ? (
              <small className="muted" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                Pick a target scene.
              </small>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
