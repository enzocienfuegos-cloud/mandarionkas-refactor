import type { BrandKit, ResolvedBrandKitTokens } from './types';

export function resolveBrandKitTokens(brandKit: BrandKit): ResolvedBrandKitTokens {
  const colors = brandKit.colors ?? {};
  const typography = brandKit.typography ?? {};
  const radii = brandKit.radii ?? {};
  const motion = brandKit.motion ?? {};
  const logos = brandKit.logos ?? {};

  return {
    backgroundColor: colors.background ?? colors.surface,
    surfaceColor: colors.surface ?? colors.background,
    textColor: colors.text,
    accentColor: colors.accent,
    borderColor: colors.border ?? colors.muted,
    mutedColor: colors.muted,
    fontFamily: typography.fontFamily ?? typography.bodyFamily ?? typography.headingFamily,
    headingFontFamily: typography.headingFamily ?? typography.fontFamily,
    bodyFontFamily: typography.bodyFamily ?? typography.fontFamily,
    borderRadius: radii.md ?? radii.lg ?? radii.sm,
    animationDurationMs: motion.durationMs,
    animationEasing: motion.easing,
    logoUrl: logos.primaryUrl ?? logos.secondaryUrl ?? logos.iconUrl,
  };
}
