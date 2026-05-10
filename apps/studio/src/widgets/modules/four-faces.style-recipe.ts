import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { moduleShellEdit } from './shared-styles';
import { FOUR_FACES_HIDDEN_TRANSFORM, fourFacesUi } from './four-faces.ui';
import type { FaceConfig, FaceId } from './four-faces.view-model';

export { fourFacesUi } from './four-faces.ui';

export function buildArrowHintStyle(direction: Exclude<FaceId, 'home'>, color: string): CSSProperties {
  const posStyle: CSSProperties =
    direction === 'up'
      ? { top: 10, left: '50%', transform: 'translateX(-50%)' }
      : direction === 'down'
        ? { bottom: 10, left: '50%', transform: 'translateX(-50%)' }
        : direction === 'left'
          ? { left: 10, top: '50%', transform: 'translateY(-50%)' }
          : { right: 10, top: '50%', transform: 'translateY(-50%)' };

  return {
    position: 'absolute',
    ...posStyle,
    color,
    fontSize: 20,
    opacity: 0.85,
    pointerEvents: 'none',
    zIndex: 50,
    animation: 'smxFacePulse 2s ease-in-out infinite',
  };
}

export function buildDotStyle(active: boolean): CSSProperties {
  return {
    width: active ? 18 : 8,
    height: 8,
    borderRadius: 4,
    background: active ? 'var(--module-foreground)' : 'var(--module-border)',
    transition: 'all 0.3s ease',
  };
}

export function buildBackButtonStyle(color: string): CSSProperties {
  return {
    ...fourFacesUi.backButtonStyle,
    color,
  };
}

export function buildFacePanelStyle(face: FaceConfig, active: boolean): CSSProperties {
  return {
    ...fourFacesUi.facePanelBaseStyle,
    background: face.headerBg,
    transform: active ? 'translate(0,0)' : FOUR_FACES_HIDDEN_TRANSFORM[face.id],
    transition: 'transform 0.45s cubic-bezier(0.77,0,0.175,1)',
  };
}

export function buildFaceCopyStyle(face: FaceConfig): CSSProperties {
  return {
    ...fourFacesUi.faceCopyBaseStyle,
    background: face.copyBg,
  };
}

export function buildFaceTitleStyle(face: FaceConfig): CSSProperties {
  return {
    ...fourFacesUi.faceTitleStyle,
    color: face.titleColor,
  };
}

export function buildFaceBodyStyle(face: FaceConfig): CSSProperties {
  return {
    ...fourFacesUi.faceBodyStyle,
    color: face.bodyColor,
  };
}

export function buildFaceCtaStyle(face: FaceConfig): CSSProperties {
  return {
    ...fourFacesUi.faceCtaBaseStyle,
    background: face.ctaBg,
    color: face.ctaTextColor,
    boxShadow: `0 6px 20px ${face.ctaBg}55`,
  };
}

export function buildFaceMediaFallbackTextStyle(color: string): CSSProperties {
  return {
    ...fourFacesUi.faceMediaFallbackStyle,
    color,
  };
}

export function buildDismissedStyle(homeBg: string, homeTitleColor: string): CSSProperties {
  return {
    ...fourFacesUi.dismissedShellBaseStyle,
    background: homeBg,
    color: homeTitleColor,
  };
}

export function buildHomePanelStyle(homeBg: string): CSSProperties {
  return {
    ...fourFacesUi.homePanelBaseStyle,
    background: homeBg,
  };
}

export function buildHomeBrandStyle(brandColor: string): CSSProperties {
  return {
    ...fourFacesUi.homeBrandStyle,
    color: brandColor,
  };
}

export function buildHomeTitleStyle(homeTitleColor: string): CSSProperties {
  return {
    ...fourFacesUi.homeTitleStyle,
    color: homeTitleColor,
  };
}

export function buildHomeSubtitleStyle(homeSubtitleColor: string): CSSProperties {
  return {
    ...fourFacesUi.homeSubtitleStyle,
    color: homeSubtitleColor,
  };
}

export function buildHomeHeroStyle(accentColor: string): CSSProperties {
  return {
    width: '72%',
    maxWidth: 260,
    aspectRatio: '1 / 1',
    objectFit: 'cover',
    borderRadius: 16,
    boxShadow: `0 12px 40px ${accentColor}30`,
    marginBottom: 18,
    display: 'block',
  };
}

export function buildHomeHeroFallbackTextStyle(color: string): CSSProperties {
  return {
    ...fourFacesUi.homeHeroFallbackTextStyle,
    color,
  };
}

export function buildHomeHintStyle(homeHintColor: string): CSSProperties {
  return {
    ...fourFacesUi.homeHintStyle,
    color: homeHintColor,
  };
}

export function buildHomeCtaStyle(homeCtaBg: string, homeCtaTextColor: string): CSSProperties {
  return {
    ...fourFacesUi.homeCtaBaseStyle,
    background: homeCtaBg,
    color: homeCtaTextColor,
    boxShadow: `0 6px 20px ${homeCtaBg}50`,
  };
}

export function buildCloseButtonStyle(closeButtonBg: string, closeButtonColor: string): CSSProperties {
  return {
    ...fourFacesUi.closeButtonBaseStyle,
    background: closeButtonBg,
    color: closeButtonColor,
  };
}

export function buildFourFacesShellStyle(
  node: WidgetNode,
  ctx: RenderContext,
  dismissed: boolean,
  cssVars: Record<string, string>,
): CSSProperties {
  return ctx.previewMode
    ? {
      ...cssVars,
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--module-backgroundStrong)',
      touchAction: 'none',
      userSelect: 'none',
      cursor: dismissed ? 'default' : 'grab',
    }
    : {
      ...moduleShellEdit(node),
      ...cssVars,
      position: 'relative',
      overflow: 'hidden',
      touchAction: 'none',
    };
}
