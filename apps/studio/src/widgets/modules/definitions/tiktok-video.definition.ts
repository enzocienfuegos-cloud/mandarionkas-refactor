import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderTikTokVideoStage } from '../tiktok-video.renderer';
import { TikTokVideoInspector } from '../tiktok-video.inspector';
import {
  TIKTOK_VIDEO_DEFAULT_CAPTION,
  TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT,
  TIKTOK_VIDEO_DEFAULT_CTA_LABEL,
  TIKTOK_VIDEO_DEFAULT_HASHTAGS,
  TIKTOK_VIDEO_DEFAULT_LIKES_COUNT,
  TIKTOK_VIDEO_DEFAULT_PROPS,
  TIKTOK_VIDEO_DEFAULT_SHARES_COUNT,
  TIKTOK_VIDEO_DEFAULT_USERNAME,
} from '../tiktok-video.shared';
import { TikTokVideoThumb } from '../../registry/widget-thumbnails';

export const TikTokVideoDefinition = createModuleDefinition({
  type: 'tiktok-video',
  label: 'TikTok Video',
  category: 'media',
  thumbnail: TikTokVideoThumb,
  frame: { x: 40, y: 40, width: 300, height: 600, rotation: 0 },
  props: TIKTOK_VIDEO_DEFAULT_PROPS,
  style: {
    backgroundColor: '#000000',
    color: '#ffffff',
    borderRadius: 0,
    opacity: 1,
    modulePreset: 'social',
  },
  renderStage: renderTikTokVideoStage,
  renderInspector: (node) => createElement(TikTokVideoInspector, { node }),
  exportDetail: 'TikTok-style video ad 300×600',
  buildPortableExport: (node) => ({
    props: {
      exportRole: 'tiktok-video',
      videoSrc: String(node.props.videoSrc ?? ''),
      videoAssetId: String(node.props.videoAssetId ?? ''),
      avatarSrc: String(node.props.avatarSrc ?? ''),
      avatarAssetId: String(node.props.avatarAssetId ?? ''),
      username: String(node.props.username ?? TIKTOK_VIDEO_DEFAULT_USERNAME),
      showVerified: Boolean(node.props.showVerified ?? true),
      caption: String(node.props.caption ?? TIKTOK_VIDEO_DEFAULT_CAPTION),
      hashtags: String(node.props.hashtags ?? TIKTOK_VIDEO_DEFAULT_HASHTAGS),
      likesCount: String(node.props.likesCount ?? TIKTOK_VIDEO_DEFAULT_LIKES_COUNT),
      commentsCount: String(node.props.commentsCount ?? TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT),
      sharesCount: String(node.props.sharesCount ?? TIKTOK_VIDEO_DEFAULT_SHARES_COUNT),
      ctaLabel: String(node.props.ctaLabel ?? TIKTOK_VIDEO_DEFAULT_CTA_LABEL),
      ctaUrl: String(node.props.ctaUrl ?? ''),
      ctaColor: String(node.props.ctaColor ?? '#fe2c55'),
      ctaTextColor: String(node.props.ctaTextColor ?? '#ffffff'),
      showHearts: Boolean(node.props.showHearts ?? true),
      showProgressBar: Boolean(node.props.showProgressBar ?? true),
      showMuteButton: Boolean(node.props.showMuteButton ?? true),
    },
  }),
});
