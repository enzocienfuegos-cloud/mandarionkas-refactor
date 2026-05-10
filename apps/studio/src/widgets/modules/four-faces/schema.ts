import { defineWidgetSchema } from '../../../domain/widget-schema';
import {
  FOUR_FACES_DEFAULT_GLOBAL,
  FOUR_FACES_DEFAULT_HOME,
  FOUR_FACES_DEFAULT_PROPS,
  FOUR_FACES_FACE_DEFAULTS,
  type FaceDir,
} from '../four-faces.shared';

function buildFaceFields(direction: FaceDir) {
  const defaults = FOUR_FACES_FACE_DEFAULTS[direction];
  const prefix = direction;

  return {
    [`${prefix}Title`]: { type: 'string', default: defaults.title, minLength: 1, maxLength: 160 },
    [`${prefix}TitleColor`]: { type: 'color', default: defaults.titleColor },
    [`${prefix}Body`]: { type: 'string', default: defaults.body, maxLength: 320 },
    [`${prefix}BodyColor`]: { type: 'color', default: defaults.bodyColor },
    [`${prefix}CtaLabel`]: { type: 'string', default: defaults.ctaLabel, minLength: 1, maxLength: 80 },
    [`${prefix}CtaUrl`]: { type: 'string', default: defaults.ctaUrl, maxLength: 2_048 },
    [`${prefix}ImageSrc`]: { type: 'asset-ref', default: defaults.imageSrc, kind: 'image' },
    [`${prefix}ImageAssetId`]: { type: 'string', default: defaults.imageAssetId, maxLength: 200 },
    [`${prefix}HeaderBg`]: { type: 'color', default: defaults.headerBg },
    [`${prefix}CopyBg`]: { type: 'color', default: defaults.copyBg },
    [`${prefix}CtaBg`]: { type: 'color', default: defaults.ctaBg },
    [`${prefix}CtaTextColor`]: { type: 'color', default: defaults.ctaTextColor },
  } as const;
}

export const fourFacesSchema = defineWidgetSchema({
  version: 1,
  fields: {
    title: { type: 'string', default: FOUR_FACES_DEFAULT_GLOBAL.title, minLength: 1, maxLength: 120 },
    accentColor: { type: 'color', default: FOUR_FACES_DEFAULT_GLOBAL.accentColor },
    showDots: { type: 'boolean', default: FOUR_FACES_DEFAULT_GLOBAL.showDots },
    showArrows: { type: 'boolean', default: FOUR_FACES_DEFAULT_GLOBAL.showArrows },
    showCloseButton: { type: 'boolean', default: FOUR_FACES_DEFAULT_GLOBAL.showCloseButton },
    swipeThreshold: { type: 'number', default: FOUR_FACES_DEFAULT_GLOBAL.swipeThreshold, min: 10, max: 240, integer: true },
    closeButtonBg: { type: 'color', default: FOUR_FACES_DEFAULT_GLOBAL.closeButtonBg },
    closeButtonColor: { type: 'color', default: FOUR_FACES_DEFAULT_GLOBAL.closeButtonColor },
    brandName: { type: 'string', default: FOUR_FACES_DEFAULT_GLOBAL.brandName, maxLength: 120 },
    brandColor: { type: 'color', default: FOUR_FACES_DEFAULT_GLOBAL.brandColor },
    logoSrc: { type: 'asset-ref', default: FOUR_FACES_DEFAULT_GLOBAL.logoSrc, kind: 'image' },
    logoAssetId: { type: 'string', default: FOUR_FACES_DEFAULT_GLOBAL.logoAssetId, maxLength: 200 },
    heroSrc: { type: 'asset-ref', default: FOUR_FACES_DEFAULT_GLOBAL.heroSrc, kind: 'image' },
    heroAssetId: { type: 'string', default: FOUR_FACES_DEFAULT_GLOBAL.heroAssetId, maxLength: 200 },
    homeTitle: { type: 'string', default: FOUR_FACES_DEFAULT_HOME.title, minLength: 1, maxLength: 160 },
    homeTitleColor: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.titleColor },
    homeSubtitle: { type: 'string', default: FOUR_FACES_DEFAULT_HOME.subtitle, maxLength: 240 },
    homeSubtitleColor: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.subtitleColor },
    homeHintText: { type: 'string', default: FOUR_FACES_DEFAULT_HOME.hintText, maxLength: 120 },
    homeHintColor: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.hintColor },
    homeCtaLabel: { type: 'string', default: FOUR_FACES_DEFAULT_HOME.ctaLabel, minLength: 1, maxLength: 80 },
    homeCtaUrl: { type: 'string', default: FOUR_FACES_DEFAULT_HOME.ctaUrl, maxLength: 2_048 },
    homeCtaBg: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.ctaBg },
    homeCtaTextColor: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.ctaTextColor },
    homeBg: { type: 'color', default: FOUR_FACES_DEFAULT_HOME.bg },
    ...buildFaceFields('up'),
    ...buildFaceFields('down'),
    ...buildFaceFields('left'),
    ...buildFaceFields('right'),
  },
});

export const fourFacesSchemaDefaults = FOUR_FACES_DEFAULT_PROPS;
