import { useEffect, useMemo, useState } from 'react';
import { getTemplate, listTemplates } from '../../../templates/library/registry';
import type { StudioTemplateVertical } from '../../../templates/library/types';
import { TemplateCard } from '../../../platform/template-gallery/TemplateCard';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { readScopedStorageItem, writeScopedStorageItem } from '../../../shared/browser/storage';
import { StudioIcon, StudioIcons } from '../../../shared/ui/icons';
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

type TemplateRailView = 'cards' | 'list';

const TEMPLATE_VIEW_ICONS: Record<TemplateRailView, typeof StudioIcons.list> = {
  cards: StudioIcons.layoutGrid,
  list: StudioIcons.list,
};

const TEMPLATE_VIEW_STORAGE_KEY = 'studio.templateLibrary.view';

export function TemplatesSection(): JSX.Element {
  const allTemplates = useMemo(() => listTemplates(), []);
  const [activeVertical, setActiveVertical] = useState<StudioTemplateVertical | 'all'>('all');
  const [view, setView] = useState<TemplateRailView>(() => {
    const stored = readScopedStorageItem(TEMPLATE_VIEW_STORAGE_KEY, 'cards');
    return stored === 'list' ? 'list' : 'cards';
  });
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

  useEffect(() => {
    writeScopedStorageItem(TEMPLATE_VIEW_STORAGE_KEY, view);
  }, [view]);

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

      <div className="widget-library-density-toggle left-rail-templates__view-toggle" role="group" aria-label="Template view">
        {(['cards', 'list'] as const).map((option) => (
          <IconButton
            key={option}
            variant="ghost"
            size="sm"
            className="widget-library-density-toggle__button"
            label={`Use ${option} template view`}
            isActive={view === option}
            icon={<StudioIcon icon={TEMPLATE_VIEW_ICONS[option]} size={14} />}
            onClick={() => setView(option)}
          />
        ))}
      </div>

      <div className={`left-rail-templates__grid left-rail-templates__grid--${view}`.trim()}>
        {filteredTemplates.map((template) => (
          <TemplateCard
            key={template.metadata.id}
            template={template}
            variant={view === 'list' ? 'rail-list' : 'rail'}
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
