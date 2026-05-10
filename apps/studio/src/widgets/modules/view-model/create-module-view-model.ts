import {
  resolveClassNamesFromSkin,
  resolveCssVarsFromTokens,
  resolveSkinFromStyle,
  resolveTokensFromSkin,
} from './module-tokens';
import type { ModuleViewModel, ModuleViewModelInput } from './types';

export function createModuleViewModel<TProps, TStyle extends Record<string, unknown>, TData>(
  input: ModuleViewModelInput<TProps, TStyle>,
  build: (props: TProps, style: TStyle) => TData,
): ModuleViewModel<TData> {
  const skin = resolveSkinFromStyle(input.style);
  const tokens = resolveTokensFromSkin(skin);
  const classNames = resolveClassNamesFromSkin(skin, input.surface);
  const cssVars = resolveCssVarsFromTokens(tokens);
  const data = build(input.props, input.style);

  return {
    type: input.type,
    surface: input.surface,
    skin,
    data,
    tokens,
    classNames,
    cssVars,
  };
}
