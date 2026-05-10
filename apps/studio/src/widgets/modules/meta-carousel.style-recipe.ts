import type { CSSProperties } from 'react';

export const metaCarouselBrandPalette = {
  border: 'var(--module-border)',
  avatarGradient: 'linear-gradient(135deg,#1877f2,#42b883)',
  primaryText: 'var(--module-foreground)',
  secondaryText: 'var(--module-foregroundMuted)',
  fallbackSurface: 'var(--module-backgroundStrong)',
  ctaBorder: 'var(--module-border)',
  ctaSurface: 'var(--module-accent)',
  dotActive: 'var(--module-accent)',
  dotInactive: 'var(--module-border)',
  placeholderTint: 'var(--module-foregroundMuted)',
} as const;

const metaHeaderShellStyle = {
  padding: '10px 12px 6px',
  borderBottom: `1px solid ${metaCarouselBrandPalette.border}`,
  flexShrink: 0,
} as const;

const metaHeaderRowBaseStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
} as const;

const metaAvatarShellStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  background: metaCarouselBrandPalette.avatarGradient,
} as const;

const metaAvatarImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const metaHeaderTextWrapStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const metaBrandNameStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: metaCarouselBrandPalette.primaryText,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaSponsoredStyle = {
  fontSize: 11,
  color: metaCarouselBrandPalette.secondaryText,
  fontFamily: 'sans-serif',
} as const;

const metaKebabStyle = {
  color: metaCarouselBrandPalette.secondaryText,
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 4px',
} as const;

const metaPrimaryTextStyle = {
  fontSize: 13,
  color: metaCarouselBrandPalette.primaryText,
  lineHeight: 1.4,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  marginBottom: 4,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
} as const;

const metaCardShellBaseStyle = {
  flexShrink: 0,
  overflow: 'hidden',
  border: `1px solid ${metaCarouselBrandPalette.border}`,
  background: 'var(--module-backgroundStrong)',
  transition: 'opacity 0.2s',
  display: 'flex',
  flexDirection: 'column',
} as const;

const metaCardMediaBaseStyle = {
  width: '100%',
  background: metaCarouselBrandPalette.fallbackSurface,
  overflow: 'hidden',
  position: 'relative',
  flexShrink: 0,
} as const;

const metaCardMediaFillStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
} as const;

const metaCardFooterStyle = {
  padding: '8px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  flex: 1,
} as const;

const metaCardCopyWrapStyle = {
  flex: 1,
  minWidth: 0,
} as const;

const metaCardTitleStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: metaCarouselBrandPalette.primaryText,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaCardDescriptionStyle = {
  fontSize: 11,
  color: metaCarouselBrandPalette.secondaryText,
  fontFamily: 'sans-serif',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

const metaCardCtaStyle = {
  flexShrink: 0,
  padding: '5px 10px',
  border: `1px solid ${metaCarouselBrandPalette.ctaBorder}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--module-foreground)',
  fontFamily: 'sans-serif',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  background: metaCarouselBrandPalette.ctaSurface,
} as const;

const metaRendererShellBaseStyle = {
  background: 'var(--module-background)',
  border: '1px solid var(--module-border)',
  borderRadius: 'var(--module-radius)',
  overflow: 'hidden',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--module-shadow)',
  backdropFilter: 'blur(var(--module-backdropBlur))',
  WebkitBackdropFilter: 'blur(var(--module-backdropBlur))',
} as const;

const metaTrackViewportStyle = {
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
  cursor: 'grab',
  userSelect: 'none',
} as const;

const metaTrackBaseStyle = {
  display: 'flex',
  height: '100%',
  boxSizing: 'border-box',
  transition: 'transform 0.3s cubic-bezier(.25,.46,.45,.94)',
} as const;

const metaArrowBaseStyle = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: `1px solid ${metaCarouselBrandPalette.border}`,
  background: 'var(--surface-card-light)',
  boxShadow: 'var(--shadow-card-elev2)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  color: metaCarouselBrandPalette.primaryText,
  zIndex: 2,
  lineHeight: 1,
} as const;

const metaDotsRowStyle = {
  display: 'flex',
  justifyContent: 'center',
  gap: 4,
  padding: '4px 0 6px',
  flexShrink: 0,
} as const;

const metaActionsRowStyle = {
  borderTop: `1px solid ${metaCarouselBrandPalette.border}`,
  padding: '6px 12px',
  display: 'flex',
  flexShrink: 0,
} as const;

const metaActionLabelStyle = {
  flex: 1,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 600,
  color: metaCarouselBrandPalette.secondaryText,
  padding: '4px 0',
  cursor: 'pointer',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

export const metaCarouselUi = {
  metaHeaderShellStyle,
  metaAvatarShellStyle,
  metaAvatarImageStyle,
  metaHeaderTextWrapStyle,
  metaBrandNameStyle,
  metaSponsoredStyle,
  metaKebabStyle,
  metaPrimaryTextStyle,
  metaCardMediaFillStyle,
  metaCardFooterStyle,
  metaCardCopyWrapStyle,
  metaCardTitleStyle,
  metaCardDescriptionStyle,
  metaCardCtaStyle,
  metaTrackViewportStyle,
  metaDotsRowStyle,
  metaActionsRowStyle,
  metaActionLabelStyle,
} as const;

export function buildMetaRendererShellStyle(cssVars: Record<string, string>) {
  return {
    ...cssVars,
    ...metaRendererShellBaseStyle,
  } as CSSProperties;
}

export function buildMetaHeaderRowStyle(hasPrimaryText: boolean): CSSProperties {
  return {
    ...metaHeaderRowBaseStyle,
    marginBottom: hasPrimaryText ? 6 : 0,
  };
}

export function buildMetaCardShellStyle(cardW: number, cardRadius: number, isActive: boolean): CSSProperties {
  return {
    ...metaCardShellBaseStyle,
    width: cardW,
    borderRadius: cardRadius,
    opacity: isActive ? 1 : 0.72,
  };
}

export function buildMetaCardMediaStyle(imageH: number): CSSProperties {
  return {
    ...metaCardMediaBaseStyle,
    height: imageH,
  };
}

export function buildMetaTrackStyle(gap: number, sidePad: number, translateX: number): CSSProperties {
  return {
    ...metaTrackBaseStyle,
    gap,
    paddingLeft: sidePad,
    paddingRight: sidePad,
    paddingTop: 8,
    paddingBottom: 8,
    transform: `translateX(-${translateX}px)`,
  };
}

export function buildMetaArrowStyle(side: 'left' | 'right'): CSSProperties {
  return {
    ...metaArrowBaseStyle,
    [side]: 4,
  } as CSSProperties;
}

export function buildMetaDotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 16 : 6,
    height: 6,
    borderRadius: 3,
    background: active ? metaCarouselBrandPalette.dotActive : metaCarouselBrandPalette.dotInactive,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };
}
