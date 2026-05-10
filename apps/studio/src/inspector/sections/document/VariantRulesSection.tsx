import { useMemo } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Tile } from '../../../shared/ui/Tile';
import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { evaluateVariantRules } from '../../../domain/variants/rule-engine';
import type { VariantCondition, VariantPatch, VariantRule } from '../../../domain/variants/types';
import { useDocumentInspectorContext } from './document-inspector-shared';
import {
  createVariantCondition,
  createVariantPatch,
  createVariantRule,
  DEFAULT_VARIANT_PREVIEW_CONTEXT,
  formatVariantConditionEquals,
  formatVariantPatchValue,
  parseVariantConditionEquals,
  parseVariantPatchValue,
  VARIANT_DEVICE_OPTIONS,
  VARIANT_TIME_OPTIONS,
  VARIANT_WEATHER_OPTIONS,
} from './variant-rules-helpers';

export function VariantRulesSection(): JSX.Element {
  const { document } = useDocumentInspectorContext();
  const { updatePlatformMetadata, applyDocumentVariantRules } = useDocumentActions();
  const rules = document.metadata.platform?.variantRules ?? [];
  const previewContext = {
    ...DEFAULT_VARIANT_PREVIEW_CONTEXT,
    ...(document.metadata.platform?.variantPreviewContext ?? {}),
  };

  const evaluation = useMemo(
    () => evaluateVariantRules(document, previewContext, rules),
    [document, previewContext, rules],
  );
  const matchingCount = evaluation.matches.filter((entry) => entry.matched).length;

  function setRules(nextRules: VariantRule[]): void {
    updatePlatformMetadata({ variantRules: nextRules });
  }

  function setPreviewContext(patch: Partial<typeof previewContext>): void {
    updatePlatformMetadata({
      variantPreviewContext: {
        ...previewContext,
        ...patch,
      },
    });
  }

  function updateRule(ruleId: string, patch: Partial<VariantRule>): void {
    setRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  }

  function updateCondition(ruleId: string, conditionIndex: number, patch: Partial<VariantCondition>): void {
    setRules(rules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        when: rule.when.map((condition, index) => (index === conditionIndex ? { ...condition, ...patch } as VariantCondition : condition)),
      };
    }));
  }

  function updatePatch(ruleId: string, patchIndex: number, patch: Partial<VariantPatch>): void {
    setRules(rules.map((rule) => {
      if (rule.id !== ruleId) return rule;
      return {
        ...rule,
        set: rule.set.map((entry, index) => (index === patchIndex ? { ...entry, ...patch } : entry)),
      };
    }));
  }

  return (
    <section className="section section-premium">
      <h3>Variants</h3>
      <div className="field-stack">
        <div className="meta-line">
          <span className="pill">{rules.length} rules</span>
          <span className={`pill${matchingCount ? ' pill-highlight' : ''}`}>{matchingCount} matching</span>
          {document.metadata.platform?.variantLastAppliedAt ? <span className="pill">Last apply {new Date(document.metadata.platform.variantLastAppliedAt).toLocaleString()}</span> : null}
        </div>
        <small className="muted">Preview a DCO context, edit rule conditions and patch paths, then apply the matching rules when you need a concrete localized version of the document.</small>
        <div className="fields-grid variant-context-grid">
          <div>
            <label>Audience</label>
            <input value={previewContext.audience ?? ''} onChange={(event) => setPreviewContext({ audience: event.target.value })} placeholder="vip" />
          </div>
          <div>
            <label>Locale</label>
            <input value={previewContext.locale ?? ''} onChange={(event) => setPreviewContext({ locale: event.target.value })} placeholder="es-SV" />
          </div>
          <div>
            <label>Weather</label>
            <select value={previewContext.weather ?? 'sunny'} onChange={(event) => setPreviewContext({ weather: event.target.value as typeof previewContext.weather })}>
              {VARIANT_WEATHER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label>Time of day</label>
            <select value={previewContext.timeOfDay ?? 'morning'} onChange={(event) => setPreviewContext({ timeOfDay: event.target.value as typeof previewContext.timeOfDay })}>
              {VARIANT_TIME_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label>Device</label>
            <select value={previewContext.device ?? 'mobile'} onChange={(event) => setPreviewContext({ device: event.target.value as typeof previewContext.device })}>
              {VARIANT_DEVICE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
        <div className="variant-rule-toolbar">
          <Button variant="ghost" size="sm" onClick={() => setRules([...rules, createVariantRule(rules.length)])}>
            Add rule
          </Button>
          <Button variant="primary" size="sm" onClick={() => applyDocumentVariantRules(previewContext, rules)} disabled={!rules.length || !matchingCount}>
            Apply matching rules
          </Button>
        </div>
        {rules.length ? (
          <>
            <div className="variant-rule-grid">
              {rules.map((rule, ruleIndex) => {
                const match = evaluation.matches.find((entry) => entry.rule.id === rule.id)?.matched;
                return (
                  <Tile key={rule.id} tone={match ? 'success' : 'neutral'} className="variant-rule-card">
                    <div className="meta-line">
                      <strong>{rule.name || `Rule ${ruleIndex + 1}`}</strong>
                      <span className={`pill${match ? ' pill-highlight' : ''}`}>{match ? 'Match' : 'Idle'}</span>
                    </div>
                    <div className="fields-grid">
                      <div>
                        <label>Rule name</label>
                        <input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} placeholder={`Rule ${ruleIndex + 1}`} />
                      </div>
                    </div>
                    <div className="variant-rule-block">
                      <div className="meta-line">
                        <strong>Conditions</strong>
                        <Button variant="ghost" size="sm" onClick={() => updateRule(rule.id, { when: [...rule.when, createVariantCondition()] })}>
                          Add condition
                        </Button>
                      </div>
                      {rule.when.map((condition, conditionIndex) => (
                        <div key={`${rule.id}-condition-${conditionIndex}`} className="variant-rule-row">
                          <select
                            value={condition.type}
                            onChange={(event) => updateCondition(rule.id, conditionIndex, createVariantCondition(event.target.value as VariantCondition['type']))}
                          >
                            <option value="audience">Audience</option>
                            <option value="locale">Locale</option>
                            <option value="weather">Weather</option>
                            <option value="timeOfDay">Time of day</option>
                            <option value="device">Device</option>
                          </select>
                          {condition.type === 'weather' ? (
                            <select value={String(condition.equals)} onChange={(event) => updateCondition(rule.id, conditionIndex, { equals: event.target.value as VariantCondition['equals'] })}>
                              {VARIANT_WEATHER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          ) : condition.type === 'timeOfDay' ? (
                            <select value={String(condition.equals)} onChange={(event) => updateCondition(rule.id, conditionIndex, { equals: event.target.value as VariantCondition['equals'] })}>
                              {VARIANT_TIME_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          ) : condition.type === 'device' ? (
                            <select value={String(condition.equals)} onChange={(event) => updateCondition(rule.id, conditionIndex, { equals: event.target.value as VariantCondition['equals'] })}>
                              {VARIANT_DEVICE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          ) : (
                            <input
                              value={formatVariantConditionEquals(condition)}
                              onChange={(event) => updateCondition(rule.id, conditionIndex, {
                                equals: parseVariantConditionEquals(condition.type, event.target.value),
                              })}
                              placeholder={condition.type === 'locale' ? 'es-SV, es-ES' : 'vip'}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateRule(rule.id, { when: rule.when.filter((_, index) => index !== conditionIndex) })}
                            disabled={rule.when.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="variant-rule-block">
                      <div className="meta-line">
                        <strong>Patches</strong>
                        <Button variant="ghost" size="sm" onClick={() => updateRule(rule.id, { set: [...rule.set, createVariantPatch()] })}>
                          Add patch
                        </Button>
                      </div>
                      {rule.set.map((entry, patchIndex) => (
                        <div key={`${rule.id}-patch-${patchIndex}`} className="variant-rule-row variant-rule-row--patch">
                          <input
                            value={entry.path}
                            onChange={(event) => updatePatch(rule.id, patchIndex, { path: event.target.value })}
                            placeholder="widgets.cta_1.props.label"
                          />
                          <input
                            value={formatVariantPatchValue(entry.value)}
                            onChange={(event) => updatePatch(rule.id, patchIndex, { value: parseVariantPatchValue(event.target.value) })}
                            placeholder="Comprar ahora"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateRule(rule.id, { set: rule.set.filter((_, index) => index !== patchIndex) })}
                            disabled={rule.set.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <small className="muted">Patch values accept plain text, numbers, booleans, <code>null</code> or JSON.</small>
                    </div>
                    <div className="variant-rule-footer">
                      <span className="pill">{rule.set.length} patches</span>
                      <Button variant="ghost" size="sm" onClick={() => setRules(rules.filter((item) => item.id !== rule.id))}>
                        Delete rule
                      </Button>
                    </div>
                  </Tile>
                );
              })}
            </div>
            <div className="variant-matrix">
              {evaluation.matches.map((entry) => (
                <div key={`matrix-${entry.rule.id}`} className={`variant-matrix-row${entry.matched ? ' is-match' : ''}`}>
                  <strong>{entry.rule.name}</strong>
                  <span className="pill">{entry.rule.when.length} conditions</span>
                  <span className="pill">{entry.rule.set.length} patches</span>
                  <span className={`pill${entry.matched ? ' pill-highlight' : ''}`}>{entry.matched ? 'Applies' : 'Skipped'}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="inspector-empty-state">
            <strong>No variant rules yet.</strong>
            <p className="muted">Start with audience or locale conditions, then map concrete patch paths like <code>widgets.cta_1.props.label</code>.</p>
          </div>
        )}
      </div>
    </section>
  );
}
