import type { CSSProperties } from 'react';
import type { StudioState } from '../../../domain/document/types';

export type ExportChannel = StudioState['document']['metadata']['release']['targetChannel'];

export type ModuleRenderSurface = 'stage' | 'export' | 'thumbnail';

export type ModuleSkinPresetId = 'solid' | 'glass' | 'editorial' | 'commerce' | 'social';
export type ModuleSkinSurface = 'solid' | 'glass' | 'editorial' | 'commerce' | 'social';
export type ModuleSkinDensity = 'compact' | 'standard' | 'immersive';
export type ModuleSkinRadius = 'sm' | 'md' | 'lg' | 'xl';
export type ModuleSkinMotion = 'none' | 'subtle' | 'premium';
export type ModuleSkinTone = 'neutral' | 'brand' | 'dark' | 'light';

export type ModuleSkin = {
  surface: ModuleSkinSurface;
  density: ModuleSkinDensity;
  radius: ModuleSkinRadius;
  motion: ModuleSkinMotion;
  tone: ModuleSkinTone;
};

export type ModuleTokenKey =
  | 'background'
  | 'backgroundStrong'
  | 'foreground'
  | 'foregroundMuted'
  | 'accent'
  | 'border'
  | 'shadow'
  | 'radius'
  | 'paddingX'
  | 'paddingY'
  | 'gap'
  | 'backdropBlur'
  | 'transitionDuration'
  | 'transitionTiming';

export type ModuleTokens = Record<ModuleTokenKey, string>;

export type ModuleClassNames = {
  root: string;
  panel: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
};

export type ModuleCssVars = Record<`--module-${ModuleTokenKey}`, string>;

export type ModuleViewModel<TData = Record<string, unknown>> = {
  type: string;
  surface: ModuleRenderSurface;
  skin: ModuleSkin;
  data: TData;
  tokens: ModuleTokens;
  classNames: ModuleClassNames;
  cssVars: ModuleCssVars;
};

export type ModuleViewModelInput<
  TProps = Record<string, unknown>,
  TStyle = Record<string, unknown>,
> = {
  type: string;
  props: TProps;
  style: TStyle;
  surface: ModuleRenderSurface;
  channel?: ExportChannel;
};

export type ModuleStyleSlot = keyof ModuleClassNames;

export type ModuleStageStyle = CSSProperties & Record<`--module-${string}`, string | number | undefined>;
