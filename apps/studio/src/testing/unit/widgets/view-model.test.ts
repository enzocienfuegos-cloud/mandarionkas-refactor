import { describe, expect, it } from 'vitest';
import { exportTokens } from '../../../export/export-tokens';
import {
  createModuleViewModel,
  getModuleSkinPreset,
  getModuleSkinPresetPatch,
  resolveClassNamesFromSkin,
  resolveCssVarsFromTokens,
  resolveSkinFromStyle,
  resolveTokensFromSkin,
  styleFromRecipe,
} from '../../../widgets/modules/view-model';

describe('module view model foundation', () => {
  it('resolves default skin values when no style hints are provided', () => {
    expect(resolveSkinFromStyle()).toEqual({
      surface: 'solid',
      density: 'standard',
      radius: 'md',
      motion: 'subtle',
      tone: 'neutral',
    });
  });

  it('resolves explicit skin hints from style props', () => {
    expect(resolveSkinFromStyle({
      moduleSurface: 'glass',
      moduleDensity: 'immersive',
      moduleRadius: 'xl',
      moduleMotion: 'premium',
      moduleTone: 'brand',
    })).toEqual({
      surface: 'glass',
      density: 'immersive',
      radius: 'xl',
      motion: 'premium',
      tone: 'brand',
    });
  });

  it('maps named premium presets to full skin defaults', () => {
    expect(getModuleSkinPreset({ modulePreset: 'social' })).toBe('social');
    expect(getModuleSkinPresetPatch('editorial')).toMatchObject({
      moduleSurface: 'editorial',
      moduleDensity: 'immersive',
      moduleRadius: 'xl',
      moduleMotion: 'subtle',
      moduleTone: 'dark',
    });
    expect(resolveSkinFromStyle({ modulePreset: 'glass' })).toEqual({
      surface: 'glass',
      density: 'standard',
      radius: 'lg',
      motion: 'premium',
      tone: 'neutral',
    });
  });

  it('builds tokens for editorial surfaces with dark foreground by default', () => {
    const tokens = resolveTokensFromSkin({
      surface: 'editorial',
      density: 'standard',
      radius: 'md',
      motion: 'subtle',
      tone: 'neutral',
    });

    expect(tokens.background).toBe('#ffffff');
    expect(tokens.foreground).toBe(exportTokens.ink);
    expect(tokens.border).toContain('rgba');
  });

  it('builds branded glass tokens with blur and accent', () => {
    const tokens = resolveTokensFromSkin({
      surface: 'glass',
      density: 'compact',
      radius: 'lg',
      motion: 'premium',
      tone: 'brand',
    });

    expect(tokens.background).toBe('rgba(15,23,42,0.72)');
    expect(tokens.accent).toBe(exportTokens.accent);
    expect(tokens.backdropBlur).toBe('18px');
    expect(tokens.transitionDuration).toBe('320ms');
  });

  it('builds stable class names for slot families', () => {
    const classNames = resolveClassNamesFromSkin({
      surface: 'social',
      density: 'compact',
      radius: 'sm',
      motion: 'none',
      tone: 'light',
    }, 'thumbnail');

    expect(classNames.root).toContain('module-vm--surface-thumbnail');
    expect(classNames.root).toContain('module-vm--skin-social');
    expect(classNames.cta).toContain('module-vm__cta');
  });

  it('maps tokens to css vars with module prefixes', () => {
    const vars = resolveCssVarsFromTokens(resolveTokensFromSkin({
      surface: 'solid',
      density: 'standard',
      radius: 'md',
      motion: 'subtle',
      tone: 'neutral',
    }));

    expect(vars['--module-background']).toBeDefined();
    expect(vars['--module-radius']).toBe('14px');
    expect(vars['--module-transitionTiming']).toContain('cubic-bezier');
  });

  it('creates a module view model with derived data and metadata', () => {
    const vm = createModuleViewModel(
      {
        type: 'demo-module',
        props: { title: 'Travel deal', price: '$49' },
        style: { moduleSurface: 'commerce', moduleTone: 'brand' },
        surface: 'stage',
      },
      (props) => ({
        title: props.title,
        priceLabel: `Only ${props.price}`,
      }),
    );

    expect(vm.type).toBe('demo-module');
    expect(vm.surface).toBe('stage');
    expect(vm.skin.surface).toBe('commerce');
    expect(vm.data).toEqual({ title: 'Travel deal', priceLabel: 'Only $49' });
    expect(vm.cssVars['--module-accent']).toBe(exportTokens.accent);
  });

  it('generates css-in-js recipes for stage surfaces', () => {
    const vm = createModuleViewModel(
      {
        type: 'demo-module',
        props: {},
        style: { moduleSurface: 'glass', moduleTone: 'brand' },
        surface: 'stage',
      },
      () => ({}),
    );

    const stageStyle = styleFromRecipe(vm, 'root', 'stage');

    expect(stageStyle).toMatchObject({
      background: vm.tokens.background,
      color: vm.tokens.foreground,
      borderRadius: vm.tokens.radius,
    });
  });

  it('generates css strings for export surfaces', () => {
    const vm = createModuleViewModel(
      {
        type: 'demo-module',
        props: {},
        style: { moduleSurface: 'glass', moduleTone: 'brand' },
        surface: 'export',
      },
      () => ({}),
    );

    const exportStyle = styleFromRecipe(vm, 'root', 'export');

    expect(typeof exportStyle).toBe('string');
    expect(exportStyle).toContain(`background:${vm.tokens.background}`);
    expect(exportStyle).toContain(`color:${vm.tokens.foreground}`);
  });

  it('keeps stage and export recipes aligned on key visual tokens', () => {
    const vm = createModuleViewModel(
      {
        type: 'demo-module',
        props: {},
        style: { moduleSurface: 'social', moduleTone: 'light', moduleRadius: 'lg' },
        surface: 'stage',
      },
      () => ({}),
    );

    const stageStyle = styleFromRecipe(vm, 'cta', 'stage');
    const exportStyle = styleFromRecipe(vm, 'cta', 'export');

    expect(stageStyle).toMatchObject({
      background: vm.tokens.accent,
      borderRadius: vm.tokens.radius,
    });
    expect(exportStyle).toContain(`background:${vm.tokens.accent}`);
    expect(exportStyle).toContain(`border-radius:${vm.tokens.radius}`);
  });
});
