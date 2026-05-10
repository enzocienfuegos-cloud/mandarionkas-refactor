import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../../domain/document/types';
import type { RenderContext } from '../../../canvas/stage/render-context';
import { moduleHeader, moduleShell } from '../shared-styles';
import { DYNAMIC_MAP_BRAND_PALETTE } from './places-loader';

export const DYNAMIC_MAP_THEME_PALETTE = {
  black: 'var(--module-background)',
  white: 'var(--module-backgroundStrong)',
  ink: 'var(--module-foreground)',
  ink900: 'var(--module-foreground)',
  slate900: 'var(--module-foreground)',
  blue600: 'hsl(217 91% 60%)',
  muted: 'var(--module-foregroundMuted)',
  mutedSecondary: 'var(--module-foregroundMuted)',
  borderSoft: 'var(--module-border)',
  whiteBorder18: 'var(--module-border)',
  whitePanel78: 'var(--module-backgroundStrong)',
  shadow20: '0 3px 14px hsl(0 0% 0% / 0.2)',
  transparent: 'hsl(0 0% 0% / 0)',
  heroOverlayStart: 'hsl(0 0% 0% / 0.18)',
  heroGradient: 'linear-gradient(160deg,var(--module-backgroundStrong),var(--module-accent))',
  darkGradient: 'linear-gradient(135deg,var(--module-backgroundStrong),var(--module-background))',
  satelliteGradient: 'linear-gradient(135deg,var(--module-accent),var(--module-background))',
  lightGradient: 'linear-gradient(135deg,var(--module-backgroundStrong),var(--module-background))',
} as const;

export const DYNAMIC_MAP_TOOLTIP_STYLES = `.leaflet-container .smx-map-label.leaflet-tooltip{background:var(--neutral-slate-900);border:none;border-radius:999px;color:var(--surface-card-light);padding:4px 8px;font-size:10px;font-weight:700;box-shadow:none;opacity:1}.leaflet-container .smx-map-label.leaflet-tooltip:before{display:none}.smx-locator-scroll::-webkit-scrollbar{width:10px}.smx-locator-scroll::-webkit-scrollbar-track{background:var(--map-scrollbar-track,var(--white-a-18));border-radius:999px}.smx-locator-scroll::-webkit-scrollbar-thumb{background:var(--map-scrollbar-thumb,var(--surface-card-light));border-radius:999px;border:2px solid hsl(0 0% 0% / 0)}`;

export const dynamicMapPalette = DYNAMIC_MAP_THEME_PALETTE;
export const dynamicMapBrandPalette = DYNAMIC_MAP_BRAND_PALETTE;
export const mapTooltipStyles = DYNAMIC_MAP_TOOLTIP_STYLES;

const searchBarShellStyle = { position: 'relative' } as const;
const mediaFillStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as const;
const fillAbsoluteStyle = { position: 'absolute', inset: 0 } as const;
const searchBarBaseLayerStyle = { ...fillAbsoluteStyle, background: dynamicMapPalette.black } as const;
const searchBarHeadlineWrapStyle = { position: 'absolute', left: 16, right: 16, bottom: 16, color: dynamicMapPalette.white } as const;
const searchBarHeadlineStyle = { fontSize: 24, fontWeight: 900, lineHeight: 1.05, textTransform: 'uppercase' } as const;
const searchBarSubheadlineStyle = { fontSize: 12, marginTop: 6, opacity: 0.92 } as const;
const searchBarBottomPanelBaseStyle = { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 } as const;
const searchBarInfoRowStyle = { display: 'flex', alignItems: 'center', gap: 8 } as const;
const searchBarSearchPillBaseStyle = { display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${dynamicMapPalette.borderSoft}`, borderRadius: 999, padding: '9px 12px' } as const;
const searchBarSearchIconStyle = { fontSize: 14, opacity: 0.6 } as const;
const searchBarSearchLabelStyle = { fontSize: 11 } as const;
const searchBarLocationRowStyle = { display: 'flex', alignItems: 'flex-start', gap: 10 } as const;
const searchBarPinBaseStyle = { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, flex: '0 0 34px' } as const;
const searchBarPrimaryMetaStyle = { flex: 1, minWidth: 0 } as const;
const searchBarBrandStyle = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.6px', opacity: 0.6 } as const;
const searchBarPrimaryAddressStyle = { fontSize: 13, fontWeight: 800, lineHeight: 1.25 } as const;
const searchBarPrimaryHoursStyle = { fontSize: 11, opacity: 0.72, lineHeight: 1.3 } as const;
const actionRowStyle = { display: 'flex', gap: 8 } as const;
const primaryActionBaseStyle = { appearance: 'none', border: 'none', borderRadius: 12, padding: '10px 14px', fontWeight: 800, fontSize: 12, cursor: 'pointer' } as const;
const searchPanelRootStyle = { ...fillAbsoluteStyle, background: dynamicMapPalette.white, display: 'flex', flexDirection: 'column', zIndex: 3 } as const;
const searchPanelHeaderBaseStyle = { height: 46, color: dynamicMapPalette.white, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10 } as const;
const searchPanelLogoStyle = { height: 22, maxWidth: 90, objectFit: 'contain' } as const;
const searchPanelTitleStyle = { fontSize: 13, fontWeight: 900, letterSpacing: '.3px', textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const searchPanelCloseStyle = { appearance: 'none', border: 'none', width: 28, height: 28, borderRadius: '50%', background: dynamicMapPalette.whiteBorder18, color: dynamicMapPalette.white, fontSize: 18, cursor: 'pointer' } as const;
const searchPanelMapBaseStyle = { position: 'relative', flex: 1, minHeight: 0 } as const;
const locateButtonBaseStyle = { position: 'absolute', right: 10, top: 10, width: 40, height: 40, borderRadius: '50%', border: 'none', background: dynamicMapPalette.white, boxShadow: dynamicMapPalette.shadow20, cursor: 'pointer', zIndex: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' } as const;
const searchPanelFooterBaseStyle = { height: 150, background: dynamicMapPalette.white, borderTop: `1px solid ${dynamicMapPalette.borderSoft}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, color: dynamicMapPalette.ink, minHeight: 0 } as const;
const locatorStatusRowStyle = { display: 'flex', alignItems: 'flex-start', gap: 10 } as const;
const locatorStatusDotBaseStyle = { width: 12, height: 12, borderRadius: '50%', marginTop: 4, flex: '0 0 12px' } as const;
const locatorStatusBodyStyle = { flex: 1, minWidth: 0 } as const;
const locatorStatusTitleStyle = { fontSize: 12, fontWeight: 900, lineHeight: 1.2 } as const;
const locatorStatusDetailStyle = { fontSize: 11, color: dynamicMapPalette.muted, lineHeight: 1.25, marginTop: 2 } as const;
const locatorListBaseStyle = { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2, scrollbarWidth: 'thin' } as const;
const locatorListHeadingStyle = { fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.5px', color: dynamicMapPalette.muted } as const;
const locatorListItemBaseStyle = { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 12, background: dynamicMapPalette.white, cursor: 'pointer' } as const;
const locatorListIndexBaseStyle = { width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flex: '0 0 20px' } as const;
const locatorListTextWrapStyle = { flex: 1, minWidth: 0 } as const;
const locatorListTitleStyle = { fontSize: 12, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const locatorListMetaStyle = { fontSize: 10, color: dynamicMapPalette.mutedSecondary, lineHeight: 1.2, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' } as const;
const badgeBaseStyle = { display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 999, fontSize: 9, fontWeight: 800, color: dynamicMapPalette.white } as const;
const locatorActionGroupStyle = { display: 'flex', gap: 8, width: 116 } as const;
const locatorExternalActionBaseStyle = { display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 12, color: dynamicMapPalette.white, fontSize: 10, fontWeight: 800, textDecoration: 'none', border: 'none', cursor: 'pointer' } as const;
const moduleHeaderRowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as const;
const moduleGridBaseStyle = { display: 'grid', gap: 10, flex: 1, minHeight: 0 } as const;
const mapCardBaseStyle = { position: 'relative', borderRadius: 12, overflow: 'hidden' } as const;
const mapStatusPillRowStyle = { position: 'absolute', left: 10, right: 10, bottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: dynamicMapPalette.slate900, opacity: 0.82 } as const;
const cardsListBaseStyle = { display: 'grid', gap: 4, overflowY: 'auto', minHeight: 0, paddingRight: 2, alignContent: 'start', scrollbarWidth: 'thin' } as const;
const compactCardBaseStyle = { borderRadius: 10, background: dynamicMapPalette.whitePanel78, padding: '7px 8px', display: 'grid', gap: 3, cursor: 'pointer' } as const;
const compactCardHeaderStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } as const;
const compactCardTitleStyle = { fontSize: 11, lineHeight: 1.1 } as const;
const compactCardBadgeBaseStyle = { fontSize: 8, borderRadius: 999, padding: '2px 5px', color: dynamicMapPalette.slate900, whiteSpace: 'nowrap' } as const;
const compactCardAddressStyle = { fontSize: 9, opacity: 0.78, lineHeight: 1.15 } as const;
const compactCardMetaRowStyle = { display: 'flex', gap: 5, flexWrap: 'wrap', fontSize: 9 } as const;
const compactCardActionsStyle = { display: 'flex', gap: 8 } as const;
const compactExternalActionBaseStyle = { display: 'inline-flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: 30, borderRadius: 12, padding: '0 9px', color: dynamicMapPalette.white, fontSize: 9, fontWeight: 800, textDecoration: 'none', border: 'none', cursor: 'pointer' } as const;

export const dynamicMapUi = {
  mediaFillStyle,
  fillAbsoluteStyle,
  searchBarBaseLayerStyle,
  searchBarHeadlineWrapStyle,
  searchBarHeadlineStyle,
  searchBarSubheadlineStyle,
  searchBarInfoRowStyle,
  searchBarSearchIconStyle,
  searchBarSearchLabelStyle,
  searchBarLocationRowStyle,
  searchBarPrimaryMetaStyle,
  searchBarBrandStyle,
  searchBarPrimaryAddressStyle,
  searchBarPrimaryHoursStyle,
  actionRowStyle,
  searchPanelRootStyle,
  searchPanelLogoStyle,
  searchPanelTitleStyle,
  searchPanelCloseStyle,
  searchPanelFooterBaseStyle,
  locatorStatusRowStyle,
  locatorStatusBodyStyle,
  locatorStatusTitleStyle,
  locatorStatusDetailStyle,
  locatorListHeadingStyle,
  locatorListTextWrapStyle,
  locatorListTitleStyle,
  locatorListMetaStyle,
  locatorActionGroupStyle,
  mapStatusPillRowStyle,
  compactCardHeaderStyle,
  compactCardTitleStyle,
  compactCardAddressStyle,
  compactCardMetaRowStyle,
  compactCardActionsStyle,
} as const;

export function buildDynamicMapShellStyle(
  node: WidgetNode,
  ctx: RenderContext,
  cssVars: CSSProperties,
): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...cssVars,
    background: 'var(--module-background)',
    color: 'var(--module-foreground)',
    borderRadius: 'var(--module-radius)',
    boxShadow: 'var(--module-shadow)',
  };
}

function buildScrollbarStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    scrollbarColor: `${scrollbarThumbColor} ${scrollbarTrackColor}`,
    ['--map-scrollbar-thumb' as any]: scrollbarThumbColor,
    ['--map-scrollbar-track' as any]: scrollbarTrackColor,
  } as CSSProperties;
}

export function buildHeroImageWrapStyle(heroHeight: string, heroImage: string): CSSProperties {
  return {
    ...fillAbsoluteStyle,
    height: heroHeight,
    overflow: 'hidden',
    background: heroImage ? dynamicMapPalette.ink900 : dynamicMapPalette.heroGradient,
  };
}

export function buildHeroOverlayStyle(heroOverlayOpacity: number): CSSProperties {
  return {
    ...fillAbsoluteStyle,
    background: `linear-gradient(to bottom, ${dynamicMapPalette.heroOverlayStart}, hsl(0 0% 0% / ${heroOverlayOpacity}))`,
  };
}

export function buildHeroLogoStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: 12,
    left: 12,
    height: 28,
    maxWidth: 110,
    objectFit: 'contain',
  };
}

export function buildSearchBarBottomPanelStyle(bottomHeight: string, bottomBackgroundColor: string): CSSProperties {
  return {
    ...searchBarBottomPanelBaseStyle,
    height: bottomHeight,
    background: bottomBackgroundColor,
    color: dynamicMapPalette.ink900,
  };
}

export function buildSearchPillStyle(searchBackgroundColor: string): CSSProperties {
  return {
    ...searchBarSearchPillBaseStyle,
    background: searchBackgroundColor,
  };
}

export function buildPrimaryPinStyle(accent: string): CSSProperties {
  return {
    ...searchBarPinBaseStyle,
    background: `${accent}22`,
    color: accent,
  };
}

export function buildPrimaryActionStyle(accent: string): CSSProperties {
  return {
    ...primaryActionBaseStyle,
    background: accent,
    color: dynamicMapPalette.white,
    flex: 1,
  };
}

export function buildSearchPanelHeaderStyle(accent: string): CSSProperties {
  return {
    ...searchPanelHeaderBaseStyle,
    background: accent,
  };
}

export function buildLocateButtonStyle(accent: string): CSSProperties {
  return {
    ...locateButtonBaseStyle,
    color: accent,
  };
}

export function buildSearchBarShellStyle(
  node: WidgetNode,
  ctx: RenderContext,
  cssVars: CSSProperties,
): CSSProperties {
  return {
    ...moduleShell(node, ctx),
    ...cssVars,
    ...searchBarShellStyle,
    background: 'var(--module-background)',
    color: 'var(--module-foreground)',
  };
}

export function buildSearchPanelMapStyle(mapBackground: string): CSSProperties {
  return {
    ...searchPanelMapBaseStyle,
    background: mapBackground,
  };
}

export function buildModuleHeaderRowStyle(node: WidgetNode): CSSProperties {
  return {
    ...moduleHeader(node),
    ...moduleHeaderRowStyle,
  };
}

export function buildLocateButtonInlineStyle(locateButtonStyle: CSSProperties): CSSProperties {
  return {
    ...locateButtonStyle,
    padding: 0,
    borderRadius: 999,
  };
}

export function buildLocatorStatusDotStyle(accent: string): CSSProperties {
  return {
    ...locatorStatusDotBaseStyle,
    background: accent,
  };
}

export function buildDirectionsButtonStyle(accent: string): CSSProperties {
  return {
    ...primaryActionBaseStyle,
    background: accent,
    color: dynamicMapPalette.white,
    whiteSpace: 'nowrap',
  };
}

export function buildLocatorListStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    ...locatorListBaseStyle,
    ...buildScrollbarStyle(scrollbarThumbColor, scrollbarTrackColor),
  };
}

export function buildLocatorListItemStyle(selected: boolean, accent: string): CSSProperties {
  return {
    ...locatorListItemBaseStyle,
    border: selected ? `1px solid ${accent}` : `1px solid ${dynamicMapPalette.borderSoft}`,
  };
}

export function buildLocatorIndexStyle(accent: string): CSSProperties {
  return {
    ...locatorListIndexBaseStyle,
    background: `${accent}22`,
    color: accent,
  };
}

export function buildBadgeStyle(accent: string): CSSProperties {
  return {
    ...badgeBaseStyle,
    background: accent,
  };
}

export function buildLocatorExternalActionStyle(background: string): CSSProperties {
  return {
    ...locatorExternalActionBaseStyle,
    background,
  };
}

export function buildModuleGridStyle(gridTemplateColumns: string, gridTemplateRows: string | undefined): CSSProperties {
  return {
    ...moduleGridBaseStyle,
    gridTemplateColumns,
    gridTemplateRows,
  };
}

export function buildMapCardStyle(stackedLayout: boolean, mapBackground: string): CSSProperties {
  return {
    ...mapCardBaseStyle,
    minHeight: stackedLayout ? 150 : 110,
    background: mapBackground,
  };
}

export function buildCardsListStyle(scrollbarThumbColor: string, scrollbarTrackColor: string): CSSProperties {
  return {
    ...cardsListBaseStyle,
    ...buildScrollbarStyle(scrollbarThumbColor, scrollbarTrackColor),
  };
}

export function buildCompactCardStyle(selected: boolean, accent: string): CSSProperties {
  return {
    ...compactCardBaseStyle,
    border: selected ? `1px solid ${accent}` : `1px solid ${accent}22`,
  };
}

export function buildCompactCardBadgeStyle(accent: string): CSSProperties {
  return {
    ...compactCardBadgeBaseStyle,
    background: `${accent}22`,
  };
}

export function buildCompactExternalActionStyle(background: string): CSSProperties {
  return {
    ...compactExternalActionBaseStyle,
    background,
  };
}

export function bindAutoScroll(container: HTMLDivElement | null, enabled: boolean, intervalMs: number): (() => void) | undefined {
  if (!container || !enabled) return undefined;
  let intervalId = 0;
  let frameId = 0;
  let direction = 1;
  const animateStep = (targetTop: number) => {
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const duration = 420;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + distance * eased;
      if (progress < 1) frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
  };
  const stepOnce = () => {
    if (!container.isConnected) return;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScroll <= 0) return;
    const stepSize = Math.max(48, Math.floor(container.clientHeight * 0.68));
    let targetTop = container.scrollTop + direction * stepSize;
    if (targetTop >= maxScroll - 1) {
      direction = -1;
      targetTop = maxScroll;
    } else if (targetTop <= 1) {
      direction = 1;
      targetTop = 0;
    }
    animateStep(Math.max(0, Math.min(maxScroll, targetTop)));
  };
  intervalId = window.setInterval(stepOnce, Math.max(900, intervalMs));
  return () => {
    if (intervalId) window.clearInterval(intervalId);
    if (frameId) window.cancelAnimationFrame(frameId);
  };
}
