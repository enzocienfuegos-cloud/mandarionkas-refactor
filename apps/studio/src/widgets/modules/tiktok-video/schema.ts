import { defineWidgetSchema } from '../../../domain/widget-schema';
import {
  TIKTOK_VIDEO_DEFAULT_CAPTION,
  TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT,
  TIKTOK_VIDEO_DEFAULT_CTA_COLOR,
  TIKTOK_VIDEO_DEFAULT_CTA_LABEL,
  TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR,
  TIKTOK_VIDEO_DEFAULT_HASHTAGS,
  TIKTOK_VIDEO_DEFAULT_LIKES_COUNT,
  TIKTOK_VIDEO_DEFAULT_PROPS,
  TIKTOK_VIDEO_DEFAULT_SHARES_COUNT,
  TIKTOK_VIDEO_DEFAULT_USERNAME,
} from '../tiktok-video.shared';

export const tiktokVideoSchema = defineWidgetSchema({
  version: 1,
  fields: {
    title: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_PROPS.title, minLength: 1, maxLength: 120 },
    videoSrc: { type: 'asset-ref', default: TIKTOK_VIDEO_DEFAULT_PROPS.videoSrc, kind: 'video' },
    videoAssetId: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_PROPS.videoAssetId, maxLength: 200 },
    username: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_USERNAME, minLength: 1, maxLength: 120 },
    showVerified: { type: 'boolean', default: TIKTOK_VIDEO_DEFAULT_PROPS.showVerified },
    avatarSrc: { type: 'asset-ref', default: TIKTOK_VIDEO_DEFAULT_PROPS.avatarSrc, kind: 'image' },
    avatarAssetId: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_PROPS.avatarAssetId, maxLength: 200 },
    caption: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_CAPTION, maxLength: 240 },
    hashtags: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_HASHTAGS, maxLength: 160 },
    likesCount: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_LIKES_COUNT, maxLength: 32 },
    commentsCount: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT, maxLength: 32 },
    sharesCount: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_SHARES_COUNT, maxLength: 32 },
    ctaLabel: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_CTA_LABEL, minLength: 1, maxLength: 80 },
    ctaUrl: { type: 'string', default: TIKTOK_VIDEO_DEFAULT_PROPS.ctaUrl, maxLength: 2_048 },
    ctaColor: { type: 'color', default: TIKTOK_VIDEO_DEFAULT_CTA_COLOR },
    ctaTextColor: { type: 'color', default: TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR },
    showHearts: { type: 'boolean', default: TIKTOK_VIDEO_DEFAULT_PROPS.showHearts },
    showProgressBar: { type: 'boolean', default: TIKTOK_VIDEO_DEFAULT_PROPS.showProgressBar },
    showMuteButton: { type: 'boolean', default: TIKTOK_VIDEO_DEFAULT_PROPS.showMuteButton },
  },
});
