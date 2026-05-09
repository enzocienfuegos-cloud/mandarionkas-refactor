import type { WidgetNode } from '../../domain/document/types';
import { validateWidgetSchemaValue } from '../../domain/widget-schema';
import { resolveSkinFromStyle, resolveTokensFromSkin } from './view-model';
import { FOUR_FACES_DEFAULT_GLOBAL, FOUR_FACES_DEFAULT_HOME, FOUR_FACES_FACE_DEFAULTS } from './four-faces.shared';
import { fourFacesSchema } from './four-faces/schema';

export type FaceId = 'home' | 'up' | 'down' | 'left' | 'right';
export type DirectionalFaceId = Exclude<FaceId, 'home'>;

export type FaceConfig = {
  id: DirectionalFaceId;
  imageSrc: string;
  title: string;
  titleColor: string;
  body: string;
  bodyColor: string;
  ctaLabel: string;
  ctaUrl: string;
  headerBg: string;
  copyBg: string;
  ctaBg: string;
  ctaTextColor: string;
};

export type FourFacesViewModel = {
  accentColor: string;
  swipeThreshold: number;
  showDots: boolean;
  showArrows: boolean;
  showCloseButton: boolean;
  closeButtonBg: string;
  closeButtonColor: string;
  homeBg: string;
  homeTitle: string;
  homeTitleColor: string;
  homeSubtitle: string;
  homeSubtitleColor: string;
  homeHintText: string;
  homeHintColor: string;
  homeCtaLabel: string;
  homeCtaUrl: string;
  homeCtaBg: string;
  homeCtaTextColor: string;
  heroSrc: string;
  brandName: string;
  brandColor: string;
  logoSrc: string;
  faces: Record<DirectionalFaceId, FaceConfig>;
};

type FaceDefaults = Pick<FaceConfig, 'headerBg' | 'copyBg' | 'titleColor' | 'bodyColor' | 'ctaBg' | 'ctaTextColor'>;

function resolveFace(
  props: WidgetNode['props'],
  direction: DirectionalFaceId,
  defaults: FaceDefaults,
): FaceConfig {
  const schemaDefaults = FOUR_FACES_FACE_DEFAULTS[direction];
  const rawTitleColor = String(props[`${direction}TitleColor`] ?? schemaDefaults.titleColor);
  const rawBodyColor = String(props[`${direction}BodyColor`] ?? schemaDefaults.bodyColor);
  const rawHeaderBg = String(props[`${direction}HeaderBg`] ?? schemaDefaults.headerBg);
  const rawCopyBg = String(props[`${direction}CopyBg`] ?? schemaDefaults.copyBg);
  const rawCtaBg = String(props[`${direction}CtaBg`] ?? schemaDefaults.ctaBg);
  const rawCtaTextColor = String(props[`${direction}CtaTextColor`] ?? schemaDefaults.ctaTextColor);

  return {
    id: direction,
    imageSrc: String(props[`${direction}ImageSrc`] ?? ''),
    title: String(props[`${direction}Title`] ?? schemaDefaults.title),
    titleColor: rawTitleColor === schemaDefaults.titleColor ? defaults.titleColor : rawTitleColor,
    body: String(props[`${direction}Body`] ?? schemaDefaults.body),
    bodyColor: rawBodyColor === schemaDefaults.bodyColor ? defaults.bodyColor : rawBodyColor,
    ctaLabel: String(props[`${direction}CtaLabel`] ?? schemaDefaults.ctaLabel),
    ctaUrl: String(props[`${direction}CtaUrl`] ?? ''),
    headerBg: rawHeaderBg === schemaDefaults.headerBg ? defaults.headerBg : rawHeaderBg,
    copyBg: rawCopyBg === schemaDefaults.copyBg ? defaults.copyBg : rawCopyBg,
    ctaBg: rawCtaBg === schemaDefaults.ctaBg ? defaults.ctaBg : rawCtaBg,
    ctaTextColor: rawCtaTextColor === schemaDefaults.ctaTextColor ? defaults.ctaTextColor : rawCtaTextColor,
  };
}

export function buildFourFacesViewModel(node: Pick<WidgetNode, 'props' | 'style'>): FourFacesViewModel {
  const props = validateWidgetSchemaValue(fourFacesSchema, node.props as Record<string, unknown>).value;
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const rawAccentColor = String(props.accentColor ?? FOUR_FACES_DEFAULT_GLOBAL.accentColor);
  const accentColor = rawAccentColor === FOUR_FACES_DEFAULT_GLOBAL.accentColor ? tokens.accent : rawAccentColor;
  const rawCloseButtonBg = String(props.closeButtonBg ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg);
  const rawCloseButtonColor = String(props.closeButtonColor ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor);
  const rawHomeBg = String(props.homeBg ?? FOUR_FACES_DEFAULT_HOME.bg);
  const rawHomeTitleColor = String(props.homeTitleColor ?? FOUR_FACES_DEFAULT_HOME.titleColor);
  const rawHomeSubtitleColor = String(props.homeSubtitleColor ?? FOUR_FACES_DEFAULT_HOME.subtitleColor);
  const rawHomeHintColor = String(props.homeHintColor ?? FOUR_FACES_DEFAULT_HOME.hintColor);
  const rawHomeCtaBg = String(props.homeCtaBg ?? FOUR_FACES_DEFAULT_HOME.ctaBg);
  const rawHomeCtaTextColor = String(props.homeCtaTextColor ?? FOUR_FACES_DEFAULT_HOME.ctaTextColor);

  return {
    accentColor,
    swipeThreshold: Number(props.swipeThreshold ?? FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold),
    showDots: Boolean(props.showDots ?? true),
    showArrows: Boolean(props.showArrows ?? true),
    showCloseButton: Boolean(props.showCloseButton ?? true),
    closeButtonBg: rawCloseButtonBg === FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg ? tokens.backgroundStrong : rawCloseButtonBg,
    closeButtonColor: rawCloseButtonColor === FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor ? tokens.foreground : rawCloseButtonColor,
    homeBg: rawHomeBg === FOUR_FACES_DEFAULT_HOME.bg ? tokens.background : rawHomeBg,
    homeTitle: String(props.homeTitle ?? FOUR_FACES_DEFAULT_HOME.title),
    homeTitleColor: rawHomeTitleColor === FOUR_FACES_DEFAULT_HOME.titleColor ? tokens.foreground : rawHomeTitleColor,
    homeSubtitle: String(props.homeSubtitle ?? FOUR_FACES_DEFAULT_HOME.subtitle),
    homeSubtitleColor: rawHomeSubtitleColor === FOUR_FACES_DEFAULT_HOME.subtitleColor ? tokens.foregroundMuted : rawHomeSubtitleColor,
    homeHintText: String(props.homeHintText ?? FOUR_FACES_DEFAULT_HOME.hintText),
    homeHintColor: rawHomeHintColor === FOUR_FACES_DEFAULT_HOME.hintColor ? tokens.foregroundMuted : rawHomeHintColor,
    homeCtaLabel: String(props.homeCtaLabel ?? FOUR_FACES_DEFAULT_HOME.ctaLabel),
    homeCtaUrl: String(props.homeCtaUrl ?? ''),
    homeCtaBg: rawHomeCtaBg === FOUR_FACES_DEFAULT_HOME.ctaBg ? accentColor : rawHomeCtaBg,
    homeCtaTextColor: rawHomeCtaTextColor === FOUR_FACES_DEFAULT_HOME.ctaTextColor ? tokens.foreground : rawHomeCtaTextColor,
    heroSrc: String(props.heroSrc ?? ''),
    brandName: String(props.brandName ?? ''),
    brandColor: String(props.brandColor ?? accentColor),
    logoSrc: String(props.logoSrc ?? ''),
    faces: {
      up: resolveFace(props, 'up', {
        headerBg: accentColor,
        copyBg: FOUR_FACES_FACE_DEFAULTS.up.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.up.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.up.bodyColor,
        ctaBg: accentColor,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.up.ctaTextColor,
      }),
      down: resolveFace(props, 'down', {
        headerBg: FOUR_FACES_FACE_DEFAULTS.down.headerBg,
        copyBg: FOUR_FACES_FACE_DEFAULTS.down.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.down.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.down.bodyColor,
        ctaBg: FOUR_FACES_FACE_DEFAULTS.down.ctaBg,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.down.ctaTextColor,
      }),
      left: resolveFace(props, 'left', {
        headerBg: FOUR_FACES_FACE_DEFAULTS.left.headerBg,
        copyBg: FOUR_FACES_FACE_DEFAULTS.left.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.left.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.left.bodyColor,
        ctaBg: accentColor,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.left.ctaTextColor,
      }),
      right: resolveFace(props, 'right', {
        headerBg: FOUR_FACES_FACE_DEFAULTS.right.headerBg,
        copyBg: FOUR_FACES_FACE_DEFAULTS.right.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.right.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.right.bodyColor,
        ctaBg: accentColor,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.right.ctaTextColor,
      }),
    },
  };
}
