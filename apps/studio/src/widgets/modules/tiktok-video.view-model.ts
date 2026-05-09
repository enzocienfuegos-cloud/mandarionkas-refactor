import type { WidgetNode } from '../../domain/document/types';
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
  const videoSrc = String(node.props.videoSrc ?? '');
  const tokens = resolveTokensFromSkin(resolveSkinFromStyle(node.style as Record<string, unknown>));
  const rawCtaColor = String(node.props.ctaColor ?? TIKTOK_VIDEO_DEFAULT_CTA_COLOR);
  const rawCtaTextColor = String(node.props.ctaTextColor ?? TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR);
  const ctaColor = rawCtaColor === TIKTOK_VIDEO_DEFAULT_CTA_COLOR ? tokens.accent : rawCtaColor;
  const ctaTextColor = rawCtaTextColor === TIKTOK_VIDEO_DEFAULT_CTA_TEXT_COLOR ? tokens.foreground : rawCtaTextColor;

  return {
    videoSrc,
    avatarSrc: String(node.props.avatarSrc ?? ''),
    username: String(node.props.username ?? TIKTOK_VIDEO_DEFAULT_USERNAME),
    caption: String(node.props.caption ?? TIKTOK_VIDEO_DEFAULT_CAPTION),
    hashtags: String(node.props.hashtags ?? TIKTOK_VIDEO_DEFAULT_HASHTAGS),
    likesCount: String(node.props.likesCount ?? TIKTOK_VIDEO_DEFAULT_LIKES_COUNT),
    commentsCount: String(node.props.commentsCount ?? TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT),
    sharesCount: String(node.props.sharesCount ?? TIKTOK_VIDEO_DEFAULT_SHARES_COUNT),
    ctaLabel: String(node.props.ctaLabel ?? TIKTOK_VIDEO_DEFAULT_CTA_LABEL),
    ctaColor,
    ctaTextColor,
    showHearts: Boolean(node.props.showHearts ?? true),
    showProgressBar: Boolean(node.props.showProgressBar ?? true),
    showMuteButton: Boolean(node.props.showMuteButton ?? true),
    showVerified: Boolean(node.props.showVerified ?? true),
    hasVideo: videoSrc.length > 0 && !videoSrc.startsWith('__'),
  };
}
