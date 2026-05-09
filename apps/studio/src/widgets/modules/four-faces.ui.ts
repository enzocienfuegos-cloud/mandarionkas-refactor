import type { CSSProperties } from 'react';
import type { FaceId } from './four-faces.view-model';

export const FOUR_FACES_HIDDEN_TRANSFORM: Record<FaceId, string> = {
  home: 'translate(0,0)',
  up: 'translateY(-100%)',
  down: 'translateY(100%)',
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
};

const dotBarStyle: CSSProperties = {
  position: 'absolute',
  bottom: 14,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 6,
  zIndex: 100,
  pointerEvents: 'none',
};

const backButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  margin: '14px 16px 0',
  fontSize: 12,
  fontWeight: 700,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: 0,
  zIndex: 5,
  flexShrink: 0,
};

const backButtonLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const facePanelBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  zIndex: 2,
  willChange: 'transform',
};

const faceMediaWrapStyle: CSSProperties = {
  width: '100%',
  height: '50%',
  flexShrink: 0,
  overflow: 'hidden',
  background: 'var(--black-a-12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const faceMediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const faceMediaFallbackStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.4,
  textAlign: 'center',
};

const faceCopyBaseStyle: CSSProperties = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '28px 28px 20px',
  clipPath: 'polygon(0 6%, 100% 0%, 100% 100%, 0% 100%)',
  textAlign: 'center',
};

const faceTitleStyle: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.15,
  marginBottom: 10,
};

const faceBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 20,
};

const faceCtaBaseStyle: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  borderRadius: 50,
  padding: '12px 36px',
  cursor: 'pointer',
  letterSpacing: '0.03em',
  flexShrink: 0,
};

const dismissedShellBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const homePanelBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  zIndex: 1,
  padding: '20px 24px',
  gap: 0,
};

const homeLogoStyle: CSSProperties = {
  height: 48,
  maxWidth: 140,
  objectFit: 'contain',
  marginBottom: 14,
};

const homeBrandStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  marginBottom: 14,
};

const homeTitleStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  textAlign: 'center',
  lineHeight: 1.1,
  marginBottom: 10,
  whiteSpace: 'pre-line',
};

const homeSubtitleStyle: CSSProperties = {
  fontSize: 14,
  textAlign: 'center',
  lineHeight: 1.5,
  marginBottom: 20,
};

const homeHeroFallbackStyle: CSSProperties = {
  width: '72%',
  maxWidth: 260,
  aspectRatio: '1 / 1',
  borderRadius: 16,
  background: 'var(--white-a-06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 18,
};

const homeHeroFallbackTextStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.4,
};

const homeHintStyle: CSSProperties = {
  fontSize: 12,
  textAlign: 'center',
  marginBottom: 18,
  letterSpacing: '0.04em',
};

const homeCtaBaseStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  border: 'none',
  borderRadius: 50,
  padding: '13px 40px',
  cursor: 'pointer',
  letterSpacing: '0.04em',
  flexShrink: 0,
};

const closeButtonBaseStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  zIndex: 999,
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1.5px solid var(--white-a-45)',
  fontSize: 14,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  pointerEvents: 'all',
};

export const fourFacesUi = {
  dotBarStyle,
  backButtonStyle,
  backButtonLabelStyle,
  facePanelBaseStyle,
  faceMediaWrapStyle,
  faceMediaStyle,
  faceMediaFallbackStyle,
  faceCopyBaseStyle,
  faceTitleStyle,
  faceBodyStyle,
  faceCtaBaseStyle,
  dismissedShellBaseStyle,
  homePanelBaseStyle,
  homeLogoStyle,
  homeBrandStyle,
  homeTitleStyle,
  homeSubtitleStyle,
  homeHeroFallbackStyle,
  homeHeroFallbackTextStyle,
  homeHintStyle,
  homeCtaBaseStyle,
  closeButtonBaseStyle,
} as const;
