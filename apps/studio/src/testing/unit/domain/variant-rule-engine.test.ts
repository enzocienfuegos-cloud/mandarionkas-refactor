import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { applyVariantPatch } from '../../../domain/variants/patcher';
import { applyVariantRules, evaluateVariantRules, matchesVariantRule } from '../../../domain/variants/rule-engine';
import type { VariantRule } from '../../../domain/variants/types';

describe('variant rule engine', () => {
  it('matches compound rules across audience, locale and device', () => {
    const rule: VariantRule = {
      id: 'rule_vip_mobile',
      name: 'VIP mobile ES',
      when: [
        { type: 'audience', equals: 'vip' },
        { type: 'locale', equals: ['es-SV', 'es-ES'] },
        { type: 'device', equals: 'mobile' },
      ],
      set: [],
    };

    expect(matchesVariantRule({
      audience: 'vip',
      locale: 'es-SV',
      device: 'mobile',
    }, rule)).toBe(true);

    expect(matchesVariantRule({
      audience: 'prospect',
      locale: 'es-SV',
      device: 'mobile',
    }, rule)).toBe(false);
  });

  it('applies patches from matching rules in order', () => {
    const state = createInitialState();
    const sceneId = state.document.scenes[0]?.id ?? 'scene_1';
    state.document.widgets.cta_1 = {
      id: 'cta_1',
      type: 'cta',
      name: 'CTA',
      sceneId,
      zIndex: 1,
      frame: { x: 0, y: 0, width: 240, height: 64, rotation: 0 },
      props: { label: 'Shop now' },
      style: { backgroundColor: '#222222', color: '#ffffff' },
      timeline: { startMs: 0, endMs: 1000 },
    };

    const rules: VariantRule[] = [
      {
        id: 'locale_copy',
        name: 'Locale copy',
        when: [{ type: 'locale', equals: 'es-SV' }],
        set: [{ path: 'widgets.cta_1.props.label', value: 'Comprar ahora' }],
      },
      {
        id: 'night_mode',
        name: 'Night mode accent',
        when: [{ type: 'timeOfDay', equals: 'night' }],
        set: [{ path: 'widgets.cta_1.style.backgroundColor', value: '#ff6a00' }],
      },
    ];

    const updated = applyVariantRules(state.document, {
      locale: 'es-SV',
      timeOfDay: 'night',
    }, rules);

    expect(updated.widgets.cta_1?.props.label).toBe('Comprar ahora');
    expect(updated.widgets.cta_1?.style.backgroundColor).toBe('#ff6a00');
  });

  it('reports which rules matched and preserves the original document for non-matching rules', () => {
    const state = createInitialState();
    const result = evaluateVariantRules(state.document, { weather: 'sunny' }, [
      {
        id: 'weather_ok',
        name: 'Sunny state',
        when: [{ type: 'weather', equals: 'sunny' }],
        set: [{ path: 'canvas.backgroundColor', value: '#ffe48a' }],
      },
      {
        id: 'desktop_only',
        name: 'Desktop state',
        when: [{ type: 'device', equals: 'desktop' }],
        set: [{ path: 'name', value: 'Desktop version' }],
      },
    ]);

    expect(result.matches.map((entry) => [entry.rule.id, entry.matched])).toEqual([
      ['weather_ok', true],
      ['desktop_only', false],
    ]);
    expect(result.document.canvas.backgroundColor).toBe('#ffe48a');
    expect(result.document.name).toBe(state.document.name);
  });
});

describe('variant patcher', () => {
  it('can patch array-backed document paths', () => {
    const state = createInitialState();
    const updated = applyVariantPatch(state.document, {
      path: 'scenes.0.name',
      value: 'Intro scene',
    });

    expect(updated.scenes[0]?.name).toBe('Intro scene');
  });
});
