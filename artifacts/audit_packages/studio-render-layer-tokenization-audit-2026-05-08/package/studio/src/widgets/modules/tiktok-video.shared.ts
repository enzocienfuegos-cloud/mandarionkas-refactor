export const TIKTOK_VIDEO_DEFAULT_USERNAME = 'yourbrand';
export const TIKTOK_VIDEO_DEFAULT_CAPTION = 'Your ad copy goes here. Two lines visible.';
export const TIKTOK_VIDEO_DEFAULT_HASHTAGS = '#trending #fyp';
export const TIKTOK_VIDEO_DEFAULT_LIKES_COUNT = '12.4K';
export const TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT = '842';
export const TIKTOK_VIDEO_DEFAULT_SHARES_COUNT = '1.2K';
export const TIKTOK_VIDEO_DEFAULT_CTA_LABEL = 'Shop Now';

export const TIKTOK_VIDEO_DEFAULT_PROPS = {
  title: 'TikTok Video',
  videoSrc: '',
  videoAssetId: '',
  username: TIKTOK_VIDEO_DEFAULT_USERNAME,
  showVerified: true,
  avatarSrc: '',
  avatarAssetId: '',
  caption: TIKTOK_VIDEO_DEFAULT_CAPTION,
  hashtags: TIKTOK_VIDEO_DEFAULT_HASHTAGS,
  likesCount: TIKTOK_VIDEO_DEFAULT_LIKES_COUNT,
  commentsCount: TIKTOK_VIDEO_DEFAULT_COMMENTS_COUNT,
  sharesCount: TIKTOK_VIDEO_DEFAULT_SHARES_COUNT,
  ctaLabel: TIKTOK_VIDEO_DEFAULT_CTA_LABEL,
  ctaUrl: '',
  ctaColor: '#fe2c55',
  ctaTextColor: '#ffffff',
  showHearts: true,
  showProgressBar: true,
  showMuteButton: true,
} as const;
