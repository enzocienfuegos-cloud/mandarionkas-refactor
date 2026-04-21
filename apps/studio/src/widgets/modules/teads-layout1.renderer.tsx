import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

function TeadsLayout1Renderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const brandLogoSrc = String(node.props.brandLogoSrc ?? '').trim();
  const brandName = String(node.props.brandName ?? 'Brand Name');
  const primaryText = String(node.props.primaryText ?? '');
  const mediaSrc = String(node.props.mediaSrc ?? '').trim();
  const mediaKind = String(node.props.mediaKind ?? 'image') === 'video' ? 'video' : 'image';
  const websiteDisplay = String(node.props.websiteDisplay ?? 'brand.com');
  const description = String(node.props.description ?? '');
  const headline = String(node.props.headline ?? '');
  const ctaLabel = String(node.props.ctaLabel ?? 'Learn More');

  return (
    <div style={{
      width: '100%', height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'column',
      border: '1px solid #e4e6eb', borderRadius: 8, overflow: 'hidden',
      fontFamily: FONT,
    }}>
      {/* Brand header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
          background: '#e4e6eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {brandLogoSrc
            ? <img src={brandLogoSrc} alt={brandName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 11, color: '#90959c' }}>Logo</span>
          }
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#050505', lineHeight: 1.2 }}>{brandName}</div>
          <div style={{ fontSize: 11, color: '#65676b' }}>Sponsored</div>
        </div>
      </div>

      {/* Primary text */}
      {primaryText ? (
        <div style={{ padding: '0 12px 8px', fontSize: 13, color: '#050505', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
          {primaryText}
        </div>
      ) : null}

      {/* Media — grows to fill available space */}
      <div style={{ flex: 1, background: '#e4e6eb', overflow: 'hidden', position: 'relative', minHeight: 120 }}>
        {mediaSrc
          ? mediaKind === 'video'
            ? <video src={mediaSrc} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={mediaSrc} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#90959c', fontSize: 12 }}>
              {mediaKind === 'video' ? '▶ Video not set' : '◻ Image not set'}
            </div>
          )
        }
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px 10px', borderTop: '1px solid #e4e6eb' }}>
        {/* Website */}
        {websiteDisplay ? (
          <div style={{ fontSize: 11, color: '#65676b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {websiteDisplay}
          </div>
        ) : null}
        {/* Headline + CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {headline ? (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#050505', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {headline}
              </div>
            ) : null}
            {description ? (
              <div style={{ fontSize: 11, color: '#65676b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {description}
              </div>
            ) : null}
          </div>
          <div style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 4,
            background: '#e4e6eb', border: '1px solid #c8ccd0',
            fontSize: 12, fontWeight: 700, color: '#050505', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {ctaLabel}
          </div>
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
