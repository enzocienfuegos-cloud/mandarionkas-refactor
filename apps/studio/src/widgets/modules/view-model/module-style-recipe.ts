import type { ModuleStyleSlot, ModuleStageStyle, ModuleViewModel } from './types';

type StyleValue = string | number;
type StyleRecord = Record<string, StyleValue | undefined>;

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function serializeStyleRecord(style: StyleRecord): string {
  return Object.entries(style)
    .filter((entry): entry is [string, StyleValue] => entry[1] !== undefined)
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(';');
}

function buildSlotStyle(vm: ModuleViewModel, slot: ModuleStyleSlot): StyleRecord {
  switch (slot) {
    case 'root':
      return {
        display: 'grid',
        gap: vm.tokens.gap,
        padding: `${vm.tokens.paddingY} ${vm.tokens.paddingX}`,
        background: vm.tokens.background,
        color: vm.tokens.foreground,
        border: `1px solid ${vm.tokens.border}`,
        borderRadius: vm.tokens.radius,
        boxShadow: vm.tokens.shadow,
        backdropFilter: vm.tokens.backdropBlur === '0px' ? undefined : `blur(${vm.tokens.backdropBlur})`,
        WebkitBackdropFilter: vm.tokens.backdropBlur === '0px' ? undefined : `blur(${vm.tokens.backdropBlur})`,
        transition: `all ${vm.tokens.transitionDuration} ${vm.tokens.transitionTiming}`,
      };
    case 'panel':
      return {
        display: 'grid',
        gap: vm.tokens.gap,
        padding: vm.tokens.paddingY,
        background: vm.tokens.backgroundStrong,
        borderRadius: vm.tokens.radius,
      };
    case 'eyebrow':
      return {
        color: vm.tokens.accent,
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      };
    case 'title':
      return {
        color: vm.tokens.foreground,
        fontSize: '18px',
        fontWeight: 800,
        lineHeight: 1.2,
      };
    case 'body':
      return {
        color: vm.tokens.foregroundMuted,
        fontSize: '13px',
        lineHeight: 1.5,
      };
    case 'cta':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 14px',
        background: vm.tokens.accent,
        color: vm.skin.tone === 'light' ? vm.tokens.backgroundStrong : vm.tokens.background,
        borderRadius: vm.tokens.radius,
        fontSize: '13px',
        fontWeight: 800,
      };
    default:
      return {};
  }
}

export function styleFromRecipe(
  vm: ModuleViewModel,
  slot: ModuleStyleSlot,
  surface = vm.surface,
): string | ModuleStageStyle {
  const style = buildSlotStyle(vm, slot);
  if (surface === 'export') return serializeStyleRecord(style);
  return {
    ...vm.cssVars,
    ...style,
  } as ModuleStageStyle;
}
