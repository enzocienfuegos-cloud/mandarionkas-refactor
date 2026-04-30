import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

function TeadsLayout2Renderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const brandLogoSrc = String(node.props.brandLogoSrc ?? '').trim();
  const brandName = String(node.props.brandName ?? 'Brand Name');
  const mediaSrc = String(node.props.mediaSrc ?? '').trim();
  const mediaKind = String(node.props.mediaKind ?? 'image') === 'video' ? 'video' : 'image';
  const ctaLabel = String(node.props.ctaLabel ?? 'Learn More');
  const primaryText = String(node.props.primaryText ?? '');

  return (
    <div style={{
      width: '100%', height: '100%', background: '#fff',
      display: 'flex', flexDirection: 'column',
      border: '1px solid #e4e6eb', borderRadius: 8, overflow: 'hidden',
      fontFamily: FONT,
    }}>
      {/* Brand header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 8px' }}>
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

      {/* Media — large, grows to fill most space */}
      <div style={{ flex: 1, background: '#e4e6eb', overflow: 'hidden', position: 'relative', minHeight: 140 }}>
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

      {/* CTA button — full width, solid accent color */}
      <div style={{ padding: '0' }}>
        <div style={{
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
        }}>
          <span>{ctaLabel}</span>
          <span style={{ fontSize: 18, opacity: 0.8 }}>›</span>
        </div>
      </div>

      {/* Primary text below CTA */}
      {primaryText ? (
        <div style={{ padding: '8px 12px 10px', fontSize: 12, color: '#050505', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
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
