export type VerticalAccordionRowIndex = 1 | 2 | 3;

export const VERTICAL_ACCORDION_DEFAULTS = {
  title: 'Vertical Accordion',
  showTopbar: true,
  brandLine1: 'BRAND NAME',
  brandLine2: 'Tagline',
  logoSrc: '',
  logoAssetId: '',
  showEndcard: true,
  endcardLine1: 'BRAND',
  endcardLine2: '',
  endcardBg: '#004B93',
  endcardTextColor: '#ffffff',
  ctaText: 'Explore All >',
  ctaUrl: '',
  ctaBg: '#EE1C24',
  ctaTextColor: '#ffffff',
  autoplay: true,
  autoplayIntervalMs: 1000,
  showDots: true,
  stripHeight: 56,
  expandedHeight: 280,
  backgroundColor: '#0a0a0a',
  color: '#ffffff',
} as const;

export const VERTICAL_ACCORDION_ROW_DEFAULTS = {
  1: { title: 'Section One', chip: '', src: '', assetId: '', bg: '#004B93', textColor: '#ffffff' },
  2: { title: 'Section Two', chip: '', src: '', assetId: '', bg: '#ffffff', textColor: '#1a1a2e' },
  3: { title: 'Section Three', chip: '', src: '', assetId: '', bg: '#1a1a2e', textColor: '#ffffff' },
} satisfies Record<VerticalAccordionRowIndex, {
  title: string;
  chip: string;
  src: string;
  assetId: string;
  bg: string;
  textColor: string;
}>;

export const VERTICAL_ACCORDION_DEFAULT_PROPS = {
  title: VERTICAL_ACCORDION_DEFAULTS.title,
  showTopbar: VERTICAL_ACCORDION_DEFAULTS.showTopbar,
  brandLine1: VERTICAL_ACCORDION_DEFAULTS.brandLine1,
  brandLine2: VERTICAL_ACCORDION_DEFAULTS.brandLine2,
  logoSrc: VERTICAL_ACCORDION_DEFAULTS.logoSrc,
  logoAssetId: VERTICAL_ACCORDION_DEFAULTS.logoAssetId,
  row1Title: VERTICAL_ACCORDION_ROW_DEFAULTS[1].title,
  row1Chip: VERTICAL_ACCORDION_ROW_DEFAULTS[1].chip,
  row1Src: VERTICAL_ACCORDION_ROW_DEFAULTS[1].src,
  row1AssetId: VERTICAL_ACCORDION_ROW_DEFAULTS[1].assetId,
  row1Bg: VERTICAL_ACCORDION_ROW_DEFAULTS[1].bg,
  row1TextColor: VERTICAL_ACCORDION_ROW_DEFAULTS[1].textColor,
  row2Title: VERTICAL_ACCORDION_ROW_DEFAULTS[2].title,
  row2Chip: VERTICAL_ACCORDION_ROW_DEFAULTS[2].chip,
  row2Src: VERTICAL_ACCORDION_ROW_DEFAULTS[2].src,
  row2AssetId: VERTICAL_ACCORDION_ROW_DEFAULTS[2].assetId,
  row2Bg: VERTICAL_ACCORDION_ROW_DEFAULTS[2].bg,
  row2TextColor: VERTICAL_ACCORDION_ROW_DEFAULTS[2].textColor,
  row3Title: VERTICAL_ACCORDION_ROW_DEFAULTS[3].title,
  row3Chip: VERTICAL_ACCORDION_ROW_DEFAULTS[3].chip,
  row3Src: VERTICAL_ACCORDION_ROW_DEFAULTS[3].src,
  row3AssetId: VERTICAL_ACCORDION_ROW_DEFAULTS[3].assetId,
  row3Bg: VERTICAL_ACCORDION_ROW_DEFAULTS[3].bg,
  row3TextColor: VERTICAL_ACCORDION_ROW_DEFAULTS[3].textColor,
  showEndcard: VERTICAL_ACCORDION_DEFAULTS.showEndcard,
  endcardLine1: VERTICAL_ACCORDION_DEFAULTS.endcardLine1,
  endcardLine2: VERTICAL_ACCORDION_DEFAULTS.endcardLine2,
  endcardBg: VERTICAL_ACCORDION_DEFAULTS.endcardBg,
  endcardTextColor: VERTICAL_ACCORDION_DEFAULTS.endcardTextColor,
  ctaText: VERTICAL_ACCORDION_DEFAULTS.ctaText,
  ctaUrl: VERTICAL_ACCORDION_DEFAULTS.ctaUrl,
  ctaBg: VERTICAL_ACCORDION_DEFAULTS.ctaBg,
  ctaTextColor: VERTICAL_ACCORDION_DEFAULTS.ctaTextColor,
  autoplay: VERTICAL_ACCORDION_DEFAULTS.autoplay,
  autoplayIntervalMs: VERTICAL_ACCORDION_DEFAULTS.autoplayIntervalMs,
  showDots: VERTICAL_ACCORDION_DEFAULTS.showDots,
  stripHeight: VERTICAL_ACCORDION_DEFAULTS.stripHeight,
  expandedHeight: VERTICAL_ACCORDION_DEFAULTS.expandedHeight,
} as const;
