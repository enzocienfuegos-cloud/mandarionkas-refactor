export const TEADS_DEFAULT_BRAND_NAME = 'Brand Name';
export const TEADS_DEFAULT_CTA_LABEL = 'Learn More';
export const TEADS_DEFAULT_SPONSORED_LABEL = 'Sponsored';

export const TEADS_LAYOUT1_DEFAULT_PROPS = {
  brandLogoSrc: '',
  brandLogoAssetId: '',
  brandName: TEADS_DEFAULT_BRAND_NAME,
  primaryText: 'Our mission is to foster a sustainable advertising and media ecosystem.',
  mediaSrc: '',
  mediaAssetId: '',
  mediaKind: 'image',
  websiteDisplay: 'brand.com',
  description: 'Together, we innovate.',
  headline: 'The Global Media Platform',
  ctaLabel: TEADS_DEFAULT_CTA_LABEL,
  ctaUrl: '',
} as const;

export const TEADS_LAYOUT2_DEFAULT_PROPS = {
  brandLogoSrc: '',
  brandLogoAssetId: '',
  brandName: TEADS_DEFAULT_BRAND_NAME,
  mediaSrc: '',
  mediaAssetId: '',
  mediaKind: 'image',
  ctaLabel: TEADS_DEFAULT_CTA_LABEL,
  ctaUrl: '',
  primaryText: 'Our mission is to foster a sustainable advertising and media ecosystem that funds quality journalism.',
} as const;
