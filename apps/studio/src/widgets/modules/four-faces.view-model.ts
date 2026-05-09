import type { WidgetNode } from '../../domain/document/types';
import { resolveSkinFromStyle, resolveTokensFromSkin } from './view-model';
import { FOUR_FACES_DEFAULT_GLOBAL, FOUR_FACES_DEFAULT_HOME, FOUR_FACES_FACE_DEFAULTS } from './four-faces.shared';

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
  return {
    id: direction,
    imageSrc: String(props[`${direction}ImageSrc`] ?? ''),
    title: String(props[`${direction}Title`] ?? FOUR_FACES_FACE_DEFAULTS[direction].title),
    titleColor: String(props[`${direction}TitleColor`] ?? defaults.titleColor),
    body: String(props[`${direction}Body`] ?? FOUR_FACES_FACE_DEFAULTS[direction].body),
    bodyColor: String(props[`${direction}BodyColor`] ?? defaults.bodyColor),
    ctaLabel: String(props[`${direction}CtaLabel`] ?? FOUR_FACES_FACE_DEFAULTS[direction].ctaLabel),
    ctaUrl: String(props[`${direction}CtaUrl`] ?? ''),
    headerBg: String(props[`${direction}HeaderBg`] ?? defaults.headerBg),
    copyBg: String(props[`${direction}CopyBg`] ?? defaults.copyBg),
    ctaBg: String(props[`${direction}CtaBg`] ?? defaults.ctaBg),
    ctaTextColor: String(props[`${direction}CtaTextColor`] ?? defaults.ctaTextColor),
  };
}

export function buildFourFacesViewModel(node: Pick<WidgetNode, 'props' | 'style'>): FourFacesViewModel {
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const rawAccentColor = String(node.props.accentColor ?? FOUR_FACES_DEFAULT_GLOBAL.accentColor);
  const accentColor = rawAccentColor === FOUR_FACES_DEFAULT_GLOBAL.accentColor ? tokens.accent : rawAccentColor;
  const rawCloseButtonBg = String(node.props.closeButtonBg ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg);
  const rawCloseButtonColor = String(node.props.closeButtonColor ?? FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor);
  const rawHomeBg = String(node.props.homeBg ?? FOUR_FACES_DEFAULT_HOME.bg);
  const rawHomeTitleColor = String(node.props.homeTitleColor ?? FOUR_FACES_DEFAULT_HOME.titleColor);
  const rawHomeSubtitleColor = String(node.props.homeSubtitleColor ?? FOUR_FACES_DEFAULT_HOME.subtitleColor);
  const rawHomeHintColor = String(node.props.homeHintColor ?? FOUR_FACES_DEFAULT_HOME.hintColor);
  const rawHomeCtaBg = String(node.props.homeCtaBg ?? FOUR_FACES_DEFAULT_HOME.ctaBg);
  const rawHomeCtaTextColor = String(node.props.homeCtaTextColor ?? FOUR_FACES_DEFAULT_HOME.ctaTextColor);

  return {
    accentColor,
    swipeThreshold: Number(node.props.swipeThreshold ?? FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold),
    showDots: Boolean(node.props.showDots ?? true),
    showArrows: Boolean(node.props.showArrows ?? true),
    showCloseButton: Boolean(node.props.showCloseButton ?? true),
    closeButtonBg: rawCloseButtonBg === FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg ? tokens.backgroundStrong : rawCloseButtonBg,
    closeButtonColor: rawCloseButtonColor === FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor ? tokens.foreground : rawCloseButtonColor,
    homeBg: rawHomeBg === FOUR_FACES_DEFAULT_HOME.bg ? tokens.background : rawHomeBg,
    homeTitle: String(node.props.homeTitle ?? FOUR_FACES_DEFAULT_HOME.title),
    homeTitleColor: rawHomeTitleColor === FOUR_FACES_DEFAULT_HOME.titleColor ? tokens.foreground : rawHomeTitleColor,
    homeSubtitle: String(node.props.homeSubtitle ?? FOUR_FACES_DEFAULT_HOME.subtitle),
    homeSubtitleColor: rawHomeSubtitleColor === FOUR_FACES_DEFAULT_HOME.subtitleColor ? tokens.foregroundMuted : rawHomeSubtitleColor,
    homeHintText: String(node.props.homeHintText ?? FOUR_FACES_DEFAULT_HOME.hintText),
    homeHintColor: rawHomeHintColor === FOUR_FACES_DEFAULT_HOME.hintColor ? tokens.foregroundMuted : rawHomeHintColor,
    homeCtaLabel: String(node.props.homeCtaLabel ?? FOUR_FACES_DEFAULT_HOME.ctaLabel),
    homeCtaUrl: String(node.props.homeCtaUrl ?? ''),
    homeCtaBg: rawHomeCtaBg === FOUR_FACES_DEFAULT_HOME.ctaBg ? accentColor : rawHomeCtaBg,
    homeCtaTextColor: rawHomeCtaTextColor === FOUR_FACES_DEFAULT_HOME.ctaTextColor ? tokens.foreground : rawHomeCtaTextColor,
    heroSrc: String(node.props.heroSrc ?? ''),
    brandName: String(node.props.brandName ?? ''),
    brandColor: String(node.props.brandColor ?? accentColor),
    logoSrc: String(node.props.logoSrc ?? ''),
    faces: {
      up: resolveFace(node.props, 'up', {
        headerBg: accentColor,
        copyBg: FOUR_FACES_FACE_DEFAULTS.up.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.up.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.up.bodyColor,
        ctaBg: accentColor,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.up.ctaTextColor,
      }),
      down: resolveFace(node.props, 'down', {
        headerBg: FOUR_FACES_FACE_DEFAULTS.down.headerBg,
        copyBg: FOUR_FACES_FACE_DEFAULTS.down.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.down.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.down.bodyColor,
        ctaBg: FOUR_FACES_FACE_DEFAULTS.down.ctaBg,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.down.ctaTextColor,
      }),
      left: resolveFace(node.props, 'left', {
        headerBg: FOUR_FACES_FACE_DEFAULTS.left.headerBg,
        copyBg: FOUR_FACES_FACE_DEFAULTS.left.copyBg,
        titleColor: FOUR_FACES_FACE_DEFAULTS.left.titleColor,
        bodyColor: FOUR_FACES_FACE_DEFAULTS.left.bodyColor,
        ctaBg: accentColor,
        ctaTextColor: FOUR_FACES_FACE_DEFAULTS.left.ctaTextColor,
      }),
      right: resolveFace(node.props, 'right', {
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
