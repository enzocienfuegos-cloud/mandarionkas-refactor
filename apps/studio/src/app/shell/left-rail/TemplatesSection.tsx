import { useMemo, useState } from 'react';
import { getTemplate, listTemplates } from '../../../templates/library/registry';
import type { StudioTemplateVertical } from '../../../templates/library/types';
import { TemplateCard } from '../../../platform/template-gallery/TemplateCard';
import { Button } from '../../../shared/ui/Button';
import { createInitialUiState } from '../../../domain/document/factories';
import { normalizeStudioState } from '../../../domain/document/normalize-state';
import { useStudioStore } from '../../../core/store/use-studio-store';
import { useStudioSessionActions, useUiActions } from '../../../hooks/use-studio-actions';
import { useToast } from '../../../shared/ui/ToastProvider';

const VERTICAL_LABELS: Record<StudioTemplateVertical, string> = {
  auto: 'Auto',
  cpg: 'CPG',
  custom: 'Custom',
  ecommerce: 'E-commerce',
  finance: 'Finance',
  sports: 'Sports',
};

export function TemplatesSection(): JSX.Element {
  const allTemplates = useMemo(() => listTemplates(), []);
  const [activeVertical, setActiveVertical] = useState<StudioTemplateVertical | 'all'>('all');
  const state = useStudioStore((value) => value);
  const { replaceState } = useStudioSessionActions();
  const uiActions = useUiActions();
  const { pushToast } = useToast();

  const filteredTemplates = useMemo(
    () => activeVertical === 'all'
      ? allTemplates
      : allTemplates.filter((template) => template.metadata.vertical === activeVertical),
    [activeVertical, allTemplates],
  );

  function applyTemplate(templateId: string): void {
    const template = getTemplate(templateId);
    if (!template) return;
    const templateDocument = template.buildDocument({ name: state.document.name });

    const hasExistingWork = Object.keys(state.document.widgets).length > 0
      || state.document.scenes.length > 1
      || state.document.metadata.dirty;

    if (hasExistingWork && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Replace the current canvas with "${template.metadata.name}"? Your unsaved scene layout will be overwritten.`,
      );
      if (!confirmed) return;
    }

    const nextState = normalizeStudioState({
      document: {
        ...templateDocument,
        id: state.document.id,
        version: state.document.version,
        name: state.document.name,
        metadata: {
          ...templateDocument.metadata,
          dirty: true,
          lastSavedAt: state.document.metadata.lastSavedAt,
          lastAutosavedAt: state.document.metadata.lastAutosavedAt,
          platform: {
            ...(templateDocument.metadata.platform ?? {}),
            ...(state.document.metadata.platform ?? {}),
          },
        },
      },
      ui: {
        ...createInitialUiState(),
        activeProjectId: state.ui.activeProjectId,
        activeLeftTab: 'widgets',
        activeVariant: state.ui.activeVariant,
        activeFeedSource: state.ui.activeFeedSource,
        activeFeedRecordId: state.ui.activeFeedRecordId,
        stageBackdrop: state.ui.stageBackdrop,
        showStageRulers: state.ui.showStageRulers,
        showWidgetBadges: state.ui.showWidgetBadges,
      },
    });

    replaceState(nextState);
    uiActions.setLeftTab('widgets');
    pushToast({
      title: 'Template loaded',
      description: `${template.metadata.name} is now active in this project.`,
      tone: 'success',
    });
  }

  return (
    <section className="left-rail-templates">
      <div className="left-rail-templates__head">
        <div>
          <small className="left-title">Template library</small>
          <strong className="left-rail-templates__title">Campaign starters</strong>
        </div>
        <span className="pill">{allTemplates.length} ready</span>
      </div>

      <p className="left-rail-templates__copy">
        Bring the curated starters from the hub directly into Studio and swap the current canvas in one step.
      </p>

      <div className="left-rail-templates__filters" role="tablist" aria-label="Template vertical">
        <button
          type="button"
          role="tab"
          aria-selected={activeVertical === 'all'}
          className={`chip-filter ${activeVertical === 'all' ? 'is-active' : ''}`.trim()}
          onClick={() => setActiveVertical('all')}
        >
          All <span className="chip-filter__count">{allTemplates.length}</span>
        </button>
        {(Object.keys(VERTICAL_LABELS) as StudioTemplateVertical[]).map((vertical) => {
          const count = allTemplates.filter((template) => template.metadata.vertical === vertical).length;
          if (count === 0) return null;
          return (
            <button
              key={vertical}
              type="button"
              role="tab"
              aria-selected={activeVertical === vertical}
              className={`chip-filter ${activeVertical === vertical ? 'is-active' : ''}`.trim()}
              onClick={() => setActiveVertical(vertical)}
            >
              {VERTICAL_LABELS[vertical]} <span className="chip-filter__count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="left-rail-templates__grid">
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.metadata.id}
            template={template}
            variant="standard"
            onUse={applyTemplate}
          />
        ))}
      </div>

      {!filteredTemplates.length ? (
        <div className="left-rail-templates__empty">
          <strong>No templates in this filter</strong>
          <span className="muted">Switch verticals to browse the full starter library.</span>
        </div>
      ) : null}

      <div className="left-rail-templates__footer">
        <Button variant="ghost" size="sm" onClick={() => setActiveVertical('all')}>
          Show all templates
        </Button>
      </div>
    </section>
  );
}
