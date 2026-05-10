import type { BindingSource, FeedCatalog, FeedRecord, RuleCondition, SceneNode, StudioState, VariantName, WidgetNode } from './types';

export function resolveVariantOverride<T extends Record<string, unknown>>(base: T, override?: Partial<T>): T {
  return { ...base, ...(override ?? {}) };
}

export function getFeedCatalogSources(state?: StudioState): BindingSource[] {
  const catalog = state?.document.feeds;
  return Object.keys(catalog ?? { product: [], weather: [], location: [], custom: [] }) as BindingSource[];
}

export function getFeedRecords(source: BindingSource, state?: StudioState): FeedRecord[] {
  if (state) return state.document.feeds[source] ?? [];
  return [];
}

export function getActiveFeedRecord(state: StudioState, source?: BindingSource): FeedRecord | undefined {
  const selectedSource = source ?? state.ui.activeFeedSource;
  const records = getFeedRecords(selectedSource, state);
  return records.find((item) => item.id === state.ui.activeFeedRecordId) ?? records[0];
}

export function getBindingSuggestions(source: BindingSource, state?: StudioState): string[] {
  const record = getFeedRecords(source, state)[0];
  return record ? Object.keys(record.values) : [];
}

export function widgetMatchesConditions(widget: WidgetNode, state: StudioState): boolean {
  const conditions = widget.conditions;
  if (!conditions) return true;
  if (conditions.variants?.length && !conditions.variants.includes(state.ui.activeVariant)) return false;
  if (conditions.records?.length && !conditions.records.includes(state.ui.activeFeedRecordId)) return false;
  if (conditions.equals) {
    const record = getActiveFeedRecord(state, conditions.equals.source);
    const value = record?.values[conditions.equals.field] ?? '';
    if (String(value) !== String(conditions.equals.value)) return false;
  }
  return true;
}

export function resolveWidgetSnapshot(widget: WidgetNode, state: StudioState, variant?: VariantName): WidgetNode {
  const activeVariant = variant ?? state.ui.activeVariant;
  const variantOverride = activeVariant === 'default' ? undefined : widget.variants?.[activeVariant];
  const props = resolveVariantOverride(widget.props, variantOverride?.props as Record<string, unknown> | undefined);
  const style = resolveVariantOverride(widget.style, variantOverride?.style as Record<string, unknown> | undefined);

  const bindings = widget.bindings ?? {};
  const resolvedProps = { ...props };
  const resolvedStyle = { ...style };

  Object.entries(bindings).forEach(([key, binding]) => {
    const record = getActiveFeedRecord(state, binding.source);
    const mapped = record?.values[binding.field] ?? binding.fallback ?? '';
    if (key.startsWith('style.')) {
      resolvedStyle[key.replace(/^style\./, '')] = mapped;
    } else {
      resolvedProps[key] = mapped;
    }
  });

  const matches = widgetMatchesConditions(widget, state);
  return { ...widget, props: resolvedProps, style: resolvedStyle, hidden: widget.hidden || !matches };
}


function ruleMatches(rule: RuleCondition | undefined, state: StudioState): boolean {
  if (!rule) return true;
  const record = getActiveFeedRecord(state, rule.source);
  const actual = String(record?.values[rule.field] ?? '');
  const expected = String(rule.value ?? '');
  switch (rule.operator ?? 'equals') {
    case 'not-equals':
      return actual !== expected;
    case 'contains':
      return actual.toLowerCase().includes(expected.toLowerCase());
    case 'starts-with':
      return actual.toLowerCase().startsWith(expected.toLowerCase());
    case 'equals':
    default:
      return actual === expected;
  }
}

export function sceneMatchesConditions(scene: SceneNode, state: StudioState): boolean {
  const conditions = scene.conditions;
  if (!conditions) return true;
  if (conditions.variants?.length && !conditions.variants.includes(state.ui.activeVariant)) return false;
  if (conditions.records?.length && !conditions.records.includes(state.ui.activeFeedRecordId)) return false;
  if (!ruleMatches(conditions.equals, state)) return false;
  return true;
}

export function resolveNextSceneId(state: StudioState, currentSceneId: string): string | undefined {
  const scenes = [...state.document.scenes].sort((a, b) => a.order - b.order);
  const currentIndex = scenes.findIndex((scene) => scene.id === currentSceneId);
  const current = scenes[currentIndex];
  if (!current) return scenes[0]?.id;
  const branches = current.flow?.branches ?? [];
  for (const branch of branches) {
    if (ruleMatches(branch, state)) return branch.targetSceneId;
  }
  const branch = current.flow?.branchEquals;
  if (branch && ruleMatches(branch, state)) return branch.targetSceneId;
  if (current.flow?.nextSceneId) return current.flow.nextSceneId;
  for (let index = currentIndex + 1; index < scenes.length; index += 1) {
    const candidate = scenes[index];
    if (sceneMatchesConditions(candidate, state)) return candidate.id;
  }
  return undefined;
}
