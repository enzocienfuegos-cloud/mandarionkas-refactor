import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { renderCollapsedIfNeeded } from './shared-styles';
import { ModuleMediaPlaceholder } from './render-icons';
import { TEADS_DEFAULT_BRAND_NAME, TEADS_DEFAULT_CTA_LABEL, TEADS_DEFAULT_SPONSORED_LABEL } from './teads.shared';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

const teadsLayout2ShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid #e4e6eb',
  borderRadius: 8,
  overflow: 'hidden',
  fontFamily: FONT,
};

const teadsLayout2HeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px 8px',
};

const teadsLayout2LogoShellStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
  background: '#e4e6eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const teadsLayout2MediaStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const teadsLayout2LogoFallbackStyle: CSSProperties = {
  fontSize: 11,
  color: '#90959c',
};

const teadsLayout2BrandNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#050505',
  lineHeight: 1.2,
};

const teadsLayout2SponsoredStyle: CSSProperties = {
  fontSize: 11,
  color: '#65676b',
};

const teadsLayout2MediaWrapStyle: CSSProperties = {
  flex: 1,
  background: '#e4e6eb',
  overflow: 'hidden',
  position: 'relative',
  minHeight: 140,
};

const teadsLayout2CtaWrapStyle: CSSProperties = {
  padding: '0',
};

const teadsLayout2CtaStyle: CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  background: '#1877f2',
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  textAlign: 'center',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  boxSizing: 'border-box',
};

const teadsLayout2CtaIconStyle: CSSProperties = {
  opacity: 0.8,
};

const teadsLayout2PrimaryTextStyle: CSSProperties = {
  padding: '8px 12px 10px',
  fontSize: 12,
  color: '#050505',
  lineHeight: 1.45,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
};

function TeadsLayout2Renderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const brandLogoSrc = String(node.props.brandLogoSrc ?? '').trim();
  const brandName = String(node.props.brandName ?? TEADS_DEFAULT_BRAND_NAME);
  const mediaSrc = String(node.props.mediaSrc ?? '').trim();
  const mediaKind = String(node.props.mediaKind ?? 'image') === 'video' ? 'video' : 'image';
  const ctaLabel = String(node.props.ctaLabel ?? TEADS_DEFAULT_CTA_LABEL);
  const primaryText = String(node.props.primaryText ?? '');

  return (
    <div style={teadsLayout2ShellStyle}>
      {/* Brand header row */}
      <div style={teadsLayout2HeaderStyle}>
        <div style={teadsLayout2LogoShellStyle}>
          {brandLogoSrc
            ? <img src={brandLogoSrc} alt={brandName} style={teadsLayout2MediaStyle} />
            : <span style={teadsLayout2LogoFallbackStyle}>Logo</span>
          }
        </div>
        <div>
          <div style={teadsLayout2BrandNameStyle}>{brandName}</div>
          <div style={teadsLayout2SponsoredStyle}>{TEADS_DEFAULT_SPONSORED_LABEL}</div>
        </div>
      </div>

      {/* Media — large, grows to fill most space */}
      <div style={teadsLayout2MediaWrapStyle}>
        {mediaSrc
          ? mediaKind === 'video'
            ? <video src={mediaSrc} muted playsInline style={teadsLayout2MediaStyle} />
            : <img src={mediaSrc} alt="" draggable={false} style={teadsLayout2MediaStyle} />
          : <ModuleMediaPlaceholder kind={mediaKind} />
        }
      </div>

      {/* CTA button — full width, solid accent color */}
      <div style={teadsLayout2CtaWrapStyle}>
        <div style={teadsLayout2CtaStyle}>
          <span>{ctaLabel}</span>
          <StudioIcon icon={StudioIcons.chevronRight} size={18} strokeWidth={2.4} style={teadsLayout2CtaIconStyle} />
        </div>
      </div>

      {/* Primary text below CTA */}
      {primaryText ? (
        <div style={teadsLayout2PrimaryTextStyle}>
          <strong>{brandName}</strong>{' '}{primaryText}
        </div>
      ) : null}
    </div>
  );
}

export function renderTeadsLayout2Stage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <TeadsLayout2Renderer node={node} ctx={ctx} />;
}
