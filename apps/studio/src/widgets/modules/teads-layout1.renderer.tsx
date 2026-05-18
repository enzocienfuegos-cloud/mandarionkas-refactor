// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { ModuleMediaPlaceholder } from './render-icons';
import {
  TEADS_DEFAULT_BRAND_NAME,
  TEADS_DEFAULT_CTA_LABEL,
  TEADS_DEFAULT_SPONSORED_LABEL,
  TEADS_LAYOUT1_DEFAULT_PROPS,
} from './teads.shared';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const teadsLayout1BrandPalette = {
  surface: '#fff',
  border: '#e4e6eb',
  borderStrong: '#c8ccd0',
  fallbackSurface: '#e4e6eb',
  fallbackText: '#90959c',
  primaryText: '#050505',
  secondaryText: '#65676b',
} as const;

const teadsLayout1ShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: teadsLayout1BrandPalette.surface,
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${teadsLayout1BrandPalette.border}`,
  borderRadius: 8,
  overflow: 'hidden',
  fontFamily: FONT,
};

const teadsLayout1HeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px 6px',
};

const teadsLayout1LogoShellStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
  background: teadsLayout1BrandPalette.fallbackSurface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const teadsLayout1MediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const teadsLayout1LogoFallbackStyle: CSSProperties = {
  fontSize: 11,
  color: teadsLayout1BrandPalette.fallbackText,
};

const teadsLayout1BrandNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: teadsLayout1BrandPalette.primaryText,
  lineHeight: 1.2,
};

const teadsLayout1SponsoredStyle: CSSProperties = {
  fontSize: 11,
  color: teadsLayout1BrandPalette.secondaryText,
};

const teadsLayout1PrimaryTextStyle: CSSProperties = {
  padding: '0 12px 8px',
  fontSize: 13,
  color: teadsLayout1BrandPalette.primaryText,
  lineHeight: 1.45,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
};

const teadsLayout1MediaWrapStyle: CSSProperties = {
  flex: 1,
  background: teadsLayout1BrandPalette.fallbackSurface,
  overflow: 'hidden',
  position: 'relative',
  minHeight: 120,
};

const teadsLayout1FooterStyle: CSSProperties = {
  padding: '8px 12px 10px',
  borderTop: `1px solid ${teadsLayout1BrandPalette.border}`,
};

const teadsLayout1WebsiteStyle: CSSProperties = {
  fontSize: 11,
  color: teadsLayout1BrandPalette.secondaryText,
  marginBottom: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const teadsLayout1HeadlineRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const teadsLayout1CopyWrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const teadsLayout1HeadlineStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: teadsLayout1BrandPalette.primaryText,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const teadsLayout1DescriptionStyle: CSSProperties = {
  fontSize: 11,
  color: teadsLayout1BrandPalette.secondaryText,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const teadsLayout1CtaStyle: CSSProperties = {
  flexShrink: 0,
  padding: '6px 12px',
  borderRadius: 4,
  background: teadsLayout1BrandPalette.fallbackSurface,
  border: `1px solid ${teadsLayout1BrandPalette.borderStrong}`,
  fontSize: 12,
  fontWeight: 700,
  color: teadsLayout1BrandPalette.primaryText,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function TeadsLayout1Renderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const brandLogoSrc = String(node.props.brandLogoSrc ?? '').trim();
  const brandName = String(node.props.brandName ?? TEADS_DEFAULT_BRAND_NAME);
  const primaryText = String(node.props.primaryText ?? '');
  const mediaSrc = String(node.props.mediaSrc ?? '').trim();
  const mediaKind = String(node.props.mediaKind ?? 'image') === 'video' ? 'video' : 'image';
  const websiteDisplay = String(node.props.websiteDisplay ?? TEADS_LAYOUT1_DEFAULT_PROPS.websiteDisplay);
  const description = String(node.props.description ?? '');
  const headline = String(node.props.headline ?? '');
  const ctaLabel = String(node.props.ctaLabel ?? TEADS_DEFAULT_CTA_LABEL);

  return (
    <div style={teadsLayout1ShellStyle}>
      {/* Brand header row */}
      <div style={teadsLayout1HeaderStyle}>
        <div style={teadsLayout1LogoShellStyle}>
          {brandLogoSrc
            ? <img src={brandLogoSrc} alt={brandName} decoding="async" style={teadsLayout1MediaStyle} />
            : <span style={teadsLayout1LogoFallbackStyle}>Logo</span>
          }
        </div>
        <div>
          <div style={teadsLayout1BrandNameStyle}>{brandName}</div>
          <div style={teadsLayout1SponsoredStyle}>{TEADS_DEFAULT_SPONSORED_LABEL}</div>
        </div>
      </div>

      {/* Primary text */}
      {primaryText ? (
        <div style={teadsLayout1PrimaryTextStyle}>{primaryText}</div>
      ) : null}

      {/* Media — grows to fill available space */}
      <div style={teadsLayout1MediaWrapStyle}>
        {mediaSrc
          ? mediaKind === 'video'
            ? <video src={mediaSrc} muted playsInline preload="metadata" style={teadsLayout1MediaStyle} />
            : <img src={mediaSrc} alt="" decoding="async" draggable={false} style={teadsLayout1MediaStyle} />
          : <ModuleMediaPlaceholder kind={mediaKind} />
        }
      </div>

      {/* Footer */}
      <div style={teadsLayout1FooterStyle}>
        {/* Website */}
        {websiteDisplay ? (
          <div style={teadsLayout1WebsiteStyle}>{websiteDisplay}</div>
        ) : null}
        {/* Headline + CTA row */}
        <div style={teadsLayout1HeadlineRowStyle}>
          <div style={teadsLayout1CopyWrapStyle}>
            {headline ? (
              <div style={teadsLayout1HeadlineStyle}>{headline}</div>
            ) : null}
            {description ? (
              <div style={teadsLayout1DescriptionStyle}>{description}</div>
            ) : null}
          </div>
          <div style={teadsLayout1CtaStyle}>{ctaLabel}</div>
        </div>
      </div>
    </div>
  );
}

export function renderTeadsLayout1Stage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <TeadsLayout1Renderer node={node} ctx={ctx} />;
}
