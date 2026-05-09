import type { WidgetNode } from '../../domain/document/types';
import { clamp } from './shared-styles';
import { resolveSkinFromStyle, resolveTokensFromSkin } from './view-model';
import {
  VERTICAL_ACCORDION_DEFAULTS,
  VERTICAL_ACCORDION_ROW_DEFAULTS,
  type VerticalAccordionRowIndex,
} from './vertical-accordion.shared';

export type VerticalAccordionRowConfig = {
  title: string;
  chip: string;
  src: string;
  bg: string;
  textColor: string;
};

export type VerticalAccordionViewModel = {
  showTopbar: boolean;
  showEndcard: boolean;
  showDots: boolean;
  autoplay: boolean;
  autoplayIntervalMs: number;
  stripHeight: number;
  expandedHeight: number;
  topbarHeight: number;
  ctaBarHeight: number;
  logoSrc: string;
  brandLine1: string;
  brandLine2: string;
  rows: VerticalAccordionRowConfig[];
  endcardBg: string;
  endcardLine1: string;
  endcardLine2: string;
  endcardTextColor: string;
  ctaText: string;
  ctaUrl: string;
  ctaBg: string;
  ctaTextColor: string;
};

function readRow(node: Pick<WidgetNode, 'props'>, rowNumber: VerticalAccordionRowIndex): VerticalAccordionRowConfig {
  return {
    title: String(node.props[`row${rowNumber}Title`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].title),
    chip: String(node.props[`row${rowNumber}Chip`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].chip),
    src: String(node.props[`row${rowNumber}Src`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].src),
    bg: String(node.props[`row${rowNumber}Bg`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].bg),
    textColor: String(node.props[`row${rowNumber}TextColor`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].textColor),
  };
}

export function buildVerticalAccordionViewModel(node: Pick<WidgetNode, 'props' | 'style'>): VerticalAccordionViewModel {
  const showTopbar = Boolean(node.props.showTopbar ?? VERTICAL_ACCORDION_DEFAULTS.showTopbar);
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const rawEndcardBg = String(node.props.endcardBg ?? VERTICAL_ACCORDION_DEFAULTS.endcardBg);
  const rawEndcardTextColor = String(node.props.endcardTextColor ?? VERTICAL_ACCORDION_DEFAULTS.endcardTextColor);
  const rawCtaBg = String(node.props.ctaBg ?? VERTICAL_ACCORDION_DEFAULTS.ctaBg);
  const rawCtaTextColor = String(node.props.ctaTextColor ?? VERTICAL_ACCORDION_DEFAULTS.ctaTextColor);

  return {
    showTopbar,
    showEndcard: Boolean(node.props.showEndcard ?? VERTICAL_ACCORDION_DEFAULTS.showEndcard),
    showDots: Boolean(node.props.showDots ?? VERTICAL_ACCORDION_DEFAULTS.showDots),
    autoplay: Boolean(node.props.autoplay ?? VERTICAL_ACCORDION_DEFAULTS.autoplay),
    autoplayIntervalMs: clamp(
      Number(node.props.autoplayIntervalMs ?? VERTICAL_ACCORDION_DEFAULTS.autoplayIntervalMs),
      400,
      8000,
    ),
    stripHeight: clamp(Number(node.props.stripHeight ?? VERTICAL_ACCORDION_DEFAULTS.stripHeight), 36, 80),
    expandedHeight: clamp(Number(node.props.expandedHeight ?? VERTICAL_ACCORDION_DEFAULTS.expandedHeight), 100, 420),
    topbarHeight: showTopbar ? 44 : 0,
    ctaBarHeight: 48,
    logoSrc: String(node.props.logoSrc ?? ''),
    brandLine1: String(node.props.brandLine1 ?? VERTICAL_ACCORDION_DEFAULTS.brandLine1),
    brandLine2: String(node.props.brandLine2 ?? VERTICAL_ACCORDION_DEFAULTS.brandLine2),
    rows: [readRow(node, 1), readRow(node, 2), readRow(node, 3)],
    endcardBg: rawEndcardBg === VERTICAL_ACCORDION_DEFAULTS.endcardBg ? tokens.backgroundStrong : rawEndcardBg,
    endcardLine1: String(node.props.endcardLine1 ?? VERTICAL_ACCORDION_DEFAULTS.endcardLine1),
    endcardLine2: String(node.props.endcardLine2 ?? ''),
    endcardTextColor: rawEndcardTextColor === VERTICAL_ACCORDION_DEFAULTS.endcardTextColor ? tokens.foreground : rawEndcardTextColor,
    ctaText: String(node.props.ctaText ?? VERTICAL_ACCORDION_DEFAULTS.ctaText),
    ctaUrl: String(node.props.ctaUrl ?? ''),
    ctaBg: rawCtaBg === VERTICAL_ACCORDION_DEFAULTS.ctaBg ? tokens.accent : rawCtaBg,
    ctaTextColor: rawCtaTextColor === VERTICAL_ACCORDION_DEFAULTS.ctaTextColor ? tokens.foreground : rawCtaTextColor,
  };
}
