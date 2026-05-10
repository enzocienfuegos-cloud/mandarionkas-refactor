import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShellEdit } from './shared-styles';

export const tiktokBrandPalette = {
  pink: '#fe2c55',
  cyan: '#25f4ee',
  shellGradient: 'linear-gradient(180deg,var(--module-backgroundStrong) 0%,var(--module-background) 50%,var(--module-backgroundStrong) 100%)',
} as const;

const tiktokFullSizeStyle = { width: '100%', height: '100%' } as const;
const tiktokIconShellStyle = { width: '100%', height: '100%' } as const;
const tiktokMuteIconStyle = { width: 15, height: 15, fill: 'var(--text-on-media-strong)' } as const;
const tiktokVideoFillStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' } as const;
const tiktokEmptyStateStyle = {
  position: 'absolute',
  inset: 0,
  background: tiktokBrandPalette.shellGradient,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  zIndex: 0,
} as const;
const tiktokEmptyEmojiStyle = { fontSize: 32, opacity: 0.35 } as const;
const tiktokEmptyCopyStyle = {
  fontSize: 10,
  color: 'var(--text-on-media-faint)',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  textAlign: 'center',
  lineHeight: 1.7,
} as const;
const tiktokTopGradientStyle = { position: 'absolute', top: 0, left: 0, right: 0, height: 140, background: 'var(--scrim-top-strong)', zIndex: 1, pointerEvents: 'none' } as const;
const tiktokBottomGradientStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, background: 'var(--scrim-bottom-strong)', zIndex: 1, pointerEvents: 'none' } as const;
const tiktokHeartLayerStyle = { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 12, overflow: 'hidden' } as const;
const tiktokMuteButtonStyle = {
  position: 'absolute',
  top: 40,
  right: 14,
  width: 30,
  height: 30,
  borderRadius: '50%',
  background: 'var(--black-a-50)',
  border: '1.5px solid var(--white-a-28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 20,
} as const;
const tiktokSidebarStyle = { position: 'absolute', right: 10, bottom: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 10 } as const;
const tiktokSidebarActionStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 } as const;
const tiktokSidebarCountStyle = { fontSize: 10, color: 'var(--text-on-media-strong)', fontWeight: 600, textShadow: '0 1px 3px var(--black-a-50)', letterSpacing: '0.2px' } as const;
const tiktokSidebarIconStyle = { width: 25, height: 25, filter: 'drop-shadow(0 1px 4px var(--black-a-50))' } as const;
const tiktokBottomContentStyle = { position: 'absolute', bottom: 0, left: 0, right: 60, padding: '0 14px 16px', zIndex: 10 } as const;
const tiktokUsernameStyle = { fontSize: 13, fontWeight: 700, color: 'var(--text-on-media-strong)', marginBottom: 5, textShadow: '0 1px 4px var(--black-a-50)', display: 'flex', alignItems: 'center', gap: 5 } as const;
const tiktokCaptionStyle = { fontSize: 12, color: 'var(--text-on-media-soft)', lineHeight: 1.45, marginBottom: 8, textShadow: 'var(--shadow-text-on-media)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const;
const tiktokHashtagsStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text-on-media-muted)', marginBottom: 10, textShadow: 'var(--shadow-text-on-media)' } as const;
const tiktokProgressTrackStyle = { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--white-a-18)', zIndex: 15 } as const;
const tiktokPausedOverlayStyle = { position: 'absolute', inset: 0, background: 'var(--black-a-28)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 15, fontSize: 48, color: 'var(--text-on-media-strong)', pointerEvents: 'none' } as const;
const tiktokAvatarWrapStyle = { marginBottom: 14 } as const;
const tiktokAvatarRingStyle = {
  width: 46,
  height: 46,
  borderRadius: '50%',
  padding: 2.5,
  background: `linear-gradient(135deg,${tiktokBrandPalette.pink} 0%,${tiktokBrandPalette.cyan} 100%)`,
  position: 'relative',
  flexShrink: 0,
} as const;
const tiktokAvatarInnerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'var(--neutral-black)',
} as const;
const tiktokAvatarImageStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  borderRadius: '50%',
} as const;
const tiktokAvatarFallbackStyle = {
  width: '100%',
  height: '100%',
  background: 'var(--neutral-gray-800)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  color: 'var(--neutral-gray-500)',
} as const;
const tiktokAvatarPlusStyle = {
  position: 'absolute',
  bottom: -8,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: tiktokBrandPalette.pink,
  color: 'var(--text-on-media-strong)',
  fontSize: 16,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
  border: '2px solid var(--neutral-black)',
  zIndex: 1,
} as const;
const tiktokDiscBaseStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: '3px solid var(--white-a-85)',
  background: 'var(--neutral-gray-700)',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
} as const;
const tiktokCtaBaseStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 38,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.03em',
  cursor: 'pointer',
  userSelect: 'none',
} as const;
const tiktokProgressFillBaseStyle = {
  height: '100%',
  background: 'var(--text-on-media-strong)',
  transition: 'width 0.1s linear',
} as const;

export const tiktokVideoUi = {
  tiktokFullSizeStyle,
  tiktokIconShellStyle,
  tiktokMuteIconStyle,
  tiktokVideoFillStyle,
  tiktokEmptyStateStyle,
  tiktokEmptyEmojiStyle,
  tiktokEmptyCopyStyle,
  tiktokTopGradientStyle,
  tiktokBottomGradientStyle,
  tiktokHeartLayerStyle,
  tiktokMuteButtonStyle,
  tiktokSidebarStyle,
  tiktokSidebarActionStyle,
  tiktokSidebarCountStyle,
  tiktokSidebarIconStyle,
  tiktokBottomContentStyle,
  tiktokUsernameStyle,
  tiktokCaptionStyle,
  tiktokHashtagsStyle,
  tiktokProgressTrackStyle,
  tiktokPausedOverlayStyle,
  tiktokAvatarWrapStyle,
  tiktokAvatarRingStyle,
  tiktokAvatarInnerStyle,
  tiktokAvatarImageStyle,
  tiktokAvatarFallbackStyle,
  tiktokAvatarPlusStyle,
} as const;

export function buildTikTokDiscStyle(previewMode: boolean): CSSProperties {
  return {
    ...tiktokDiscBaseStyle,
    animation: previewMode ? 'smxDiscSpin 4s linear infinite' : 'none',
  };
}

export function buildTikTokCtaStyle(ctaColor: string, ctaTextColor: string): CSSProperties {
  return {
    ...tiktokCtaBaseStyle,
    background: ctaColor,
    color: ctaTextColor,
    boxShadow: `0 2px 12px ${ctaColor}80`,
  };
}

export function buildTikTokProgressFillStyle(progress: number): CSSProperties {
  return {
    ...tiktokProgressFillBaseStyle,
    width: `${progress}%`,
  };
}

export function buildTikTokShellStyle(
  node: WidgetNode,
  ctx: RenderContext,
  cssVars: Record<string, string>,
): CSSProperties {
  return ctx.previewMode
    ? {
      ...cssVars,
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'var(--module-backgroundStrong)',
      overflow: 'hidden',
      userSelect: 'none',
      cursor: 'pointer',
    }
    : {
      ...moduleShellEdit(node),
      ...cssVars,
      background: 'var(--module-backgroundStrong)',
      position: 'relative',
      overflow: 'hidden',
    };
}
