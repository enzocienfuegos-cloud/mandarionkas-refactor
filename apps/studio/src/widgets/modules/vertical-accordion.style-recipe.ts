import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShellEdit } from './shared-styles';

export const verticalAccordionBrandPalette = {
  shellBg: 'var(--module-background)',
  textStrong: 'var(--module-foreground)',
  textMuted: 'var(--module-foregroundMuted)',
  divider: 'var(--module-border)',
  shadowText: '0 1px 4px rgba(0,0,0,0.75)',
  shadowDot: '0 1px 4px rgba(0,0,0,0.5)',
  dotInactive: 'var(--module-border)',
} as const;

const accordionRowShellBaseStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  transition: 'height 0.5s cubic-bezier(0.77,0,0.18,1)',
  flexShrink: 0,
};

const accordionRowHeroBaseStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  overflow: 'hidden',
  transition: 'opacity 0.4s ease 0.1s',
};

const accordionRowImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
};

const accordionRowImageFallbackStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 11,
  opacity: 0.35,
};

const accordionRowChipWrapBaseStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  transition: 'opacity 0.3s ease 0.15s',
  pointerEvents: 'none',
};

const accordionRowChipStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: verticalAccordionBrandPalette.textStrong,
  textShadow: verticalAccordionBrandPalette.shadowText,
  lineHeight: 1.2,
};

const accordionRowStripBaseStyle: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  cursor: 'pointer',
  zIndex: 10,
  userSelect: 'none',
};

const accordionRowTitleBaseStyle: CSSProperties = {
  flex: 1,
  fontSize: 20,
  fontWeight: 900,
  textTransform: 'uppercase',
  lineHeight: 1.1,
  letterSpacing: '-0.3px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const accordionRowChevronBaseStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'transform 0.4s ease',
  opacity: 0.7,
};

const verticalAccordionPreviewShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: verticalAccordionBrandPalette.shellBg,
};

const verticalAccordionEditorShellStyle: CSSProperties = {
  background: verticalAccordionBrandPalette.shellBg,
  flexDirection: 'column',
};

const verticalAccordionTopbarStyle: CSSProperties = {
  flexShrink: 0,
  background: verticalAccordionBrandPalette.shellBg,
  borderBottom: `1px solid ${verticalAccordionBrandPalette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  zIndex: 100,
};

const verticalAccordionTopbarBrandRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const verticalAccordionTopbarLogoStyle: CSSProperties = {
  width: 28,
  height: 28,
  objectFit: 'contain',
  flexShrink: 0,
};

const verticalAccordionTopbarTitleStyle: CSSProperties = {
  color: verticalAccordionBrandPalette.textStrong,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.04em',
  lineHeight: 1.2,
  textTransform: 'uppercase',
};

const verticalAccordionTopbarSubtitleStyle: CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.15em',
  color: verticalAccordionBrandPalette.textMuted,
};

const verticalAccordionScrollAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  position: 'relative',
  scrollbarWidth: 'none',
};

const verticalAccordionDotsWrapStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 99,
  height: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  paddingTop: 8,
  pointerEvents: 'none',
};

const verticalAccordionDotBaseStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  boxShadow: verticalAccordionBrandPalette.shadowDot,
  transition: 'background 0.3s ease',
  flexShrink: 0,
};

const verticalAccordionEndcardBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 80,
  padding: '20px 16px',
  position: 'relative',
  overflow: 'hidden',
};

const verticalAccordionEndcardTitleBaseStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  textTransform: 'uppercase',
  textAlign: 'center',
  lineHeight: 1.1,
  letterSpacing: '0.03em',
};

const verticalAccordionEndcardSubtitleBaseStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  marginTop: 6,
  opacity: 0.65,
};

const verticalAccordionCtaBarBaseStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  userSelect: 'none',
};

const verticalAccordionCtaLabelBaseStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  pointerEvents: 'none',
};

export const verticalAccordionUi = {
  accordionRowImageStyle,
  accordionRowImageFallbackStyle,
  accordionRowChipStyle,
  verticalAccordionTopbarBrandRowStyle,
  verticalAccordionTopbarLogoStyle,
  verticalAccordionTopbarTitleStyle,
  verticalAccordionTopbarSubtitleStyle,
  verticalAccordionScrollAreaStyle,
  verticalAccordionDotsWrapStyle,
} as const;

export function buildAccordionRowShellStyle(
  isExpanded: boolean,
  expandedHeight: number,
  stripHeight: number,
): CSSProperties {
  return {
    ...accordionRowShellBaseStyle,
    height: isExpanded ? expandedHeight : stripHeight,
  };
}

export function buildAccordionRowHeroStyle(bg: string, heroHeight: number, isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowHeroBaseStyle,
    height: heroHeight,
    opacity: isExpanded ? 1 : 0,
    background: bg,
  };
}

export function buildAccordionRowChipWrapStyle(stripHeight: number, isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowChipWrapBaseStyle,
    bottom: stripHeight + 2,
    opacity: isExpanded ? 1 : 0,
  };
}

export function buildAccordionRowStripStyle(bg: string, stripHeight: number): CSSProperties {
  return {
    ...accordionRowStripBaseStyle,
    height: stripHeight,
    background: bg,
  };
}

export function buildAccordionRowTitleStyle(textColor: string): CSSProperties {
  return {
    ...accordionRowTitleBaseStyle,
    color: textColor,
  };
}

export function buildAccordionRowChevronStyle(isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowChevronBaseStyle,
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
  };
}

export function buildVerticalAccordionShellStyle(
  node: WidgetNode,
  ctx: RenderContext,
  cssVars: Record<string, string>,
): CSSProperties {
  if (ctx.previewMode) {
    return {
      ...cssVars,
      ...verticalAccordionPreviewShellStyle,
      opacity: Number(node.style.opacity ?? 1),
    };
  }

  return {
    ...moduleShellEdit(node),
    ...cssVars,
    ...verticalAccordionEditorShellStyle,
  };
}

export function buildVerticalAccordionTopbarStyle(height: number): CSSProperties {
  return {
    ...verticalAccordionTopbarStyle,
    height,
  };
}

export function buildVerticalAccordionDotStyle(isActive: boolean): CSSProperties {
  return {
    ...verticalAccordionDotBaseStyle,
    background: isActive ? verticalAccordionBrandPalette.textStrong : verticalAccordionBrandPalette.dotInactive,
  };
}

export function buildVerticalAccordionEndcardStyle(background: string): CSSProperties {
  return {
    ...verticalAccordionEndcardBaseStyle,
    background,
  };
}

export function buildVerticalAccordionEndcardTextStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionEndcardTitleBaseStyle,
    color,
  };
}

export function buildVerticalAccordionEndcardSubtitleStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionEndcardSubtitleBaseStyle,
    color,
  };
}

export function buildVerticalAccordionCtaBarStyle(height: number, background: string): CSSProperties {
  return {
    ...verticalAccordionCtaBarBaseStyle,
    height,
    background,
  };
}

export function buildVerticalAccordionCtaLabelStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionCtaLabelBaseStyle,
    color,
  };
}
