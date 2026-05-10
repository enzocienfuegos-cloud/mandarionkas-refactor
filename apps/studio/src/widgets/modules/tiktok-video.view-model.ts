import type { WidgetNode } from '../../domain/document/types';
import { validateWidgetSchemaValue } from '../../domain/widget-schema';
import { resolveSkinFromStyle, resolveTokensFromSkin } from './view-model';
import {
  TIKTOK_VIDEO_DEFAULT_CAPTION,
  TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT,
  TIKTOK_VIDEO_DEFAULT_CTA_LABEL,
  TIKTOK_VIDEO_DEFAULT_CTA_COLOR,
  TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR,
  TIKTOK_VIDEO_DEFAULT_HASHTAGS,
  TIKTOK_VIDEO_DEFAULT_LIKES_COUNT,
  TIKTOK_VIDEO_DEFAULT_SHARES_COUNT,
  TIKTOK_VIDEO_DEFAULT_USERNAME,
} from './tiktok-video.shared';
import { tiktokVideoSchema } from './tiktok-video/schema';

export type TikTokVideoViewModel = {
  videoSrc: string;
  avatarSrc: string;
  username: string;
  caption: string;
  hashtags: string;
  likesCount: string;
  commentsCount: string;
  sharesCount: string;
  ctaLabel: string;
  ctaColor: string;
  ctaTextColor: string;
  showHearts: boolean;
  showProgressBar: boolean;
  showMuteButton: boolean;
  showVerified: boolean;
  hasVideo: boolean;
};

export function buildTikTokVideoViewModel(node: Pick<WidgetNode, 'props' | 'style'>): TikTokVideoViewModel {
  const props = validateWidgetSchemaValue(tiktokVideoSchema, node.props as Record<string, unknown>).value;
  const videoSrc = String(props.videoSrc ?? '');
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const rawCtaColor = String(props.ctaColor ?? TIKTOK_VIDEO_DEFAULT_CTA_COLOR);
  const rawCtaTextColor = String(props.ctaTextColor ?? TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR);
  const ctaColor = rawCtaColor === TIKTOK_VIDEO_DEFAULT_CTA_COLOR ? tokens.accent : rawCtaColor;
  const ctaTextColor = rawCtaTextColor === TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR ? tokens.foreground : rawCtaTextColor;

  return {
    videoSrc,
    avatarSrc: String(props.avatarSrc ?? ''),
    username: String(props.username ?? TIKTOK_VIDEO_DEFAULT_USERNAME),
    caption: String(props.caption ?? TIKTOK_VIDEO_DEFAULT_CAPTION),
    hashtags: String(props.hashtags ?? TIKTOK_VIDEO_DEFAULT_HASHTAGS),
    likesCount: String(props.likesCount ?? TIKTOK_VIDEO_DEFAULT_LIKES_COUNT),
    commentsCount: String(props.commentsCount ?? TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT),
    sharesCount: String(props.sharesCount ?? TIKTOK_VIDEO_DEFAULT_SHARES_COUNT),
    ctaLabel: String(props.ctaLabel ?? TIKTOK_VIDEO_DEFAULT_CTA_LABEL),
    ctaColor,
    ctaTextColor,
    showHearts: Boolean(props.showHearts ?? true),
    showProgressBar: Boolean(props.showProgressBar ?? true),
    showMuteButton: Boolean(props.showMuteButton ?? true),
    showVerified: Boolean(props.showVerified ?? true),
    hasVideo: videoSrc.length > 0 && !videoSrc.startsWith('__'),
  };
}
