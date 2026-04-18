import { useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { buildQrPattern, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded, getAccent } from './shared-styles';
function QrCodeModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const url = String(node.props.url ?? 'https://example.com');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const [errored, setErrored] = useState(false);
  const pattern = useMemo(() => buildQrPattern(url), [url]);
  const qrScale = Math.max(0.3, Math.min(1, Number(node.props.qrScale ?? 0.72)));
  const qrPadding = Math.max(0, Number(node.props.qrPadding ?? 8));
  const qrSize = Math.max(72, Math.min(node.frame.width, node.frame.height - 24) * qrScale);

  return <div style={moduleShell(node, ctx)}><div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div><div style={{ ...moduleBody, alignItems: 'center', justifyContent: 'center' }}><div style={{ width: qrSize, height: qrSize, borderRadius: 14, background: '#fff', padding: qrPadding, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{!errored ? (<img src={qrUrl} alt={String(node.props.codeLabel ?? 'QR code')} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} onError={() => setErrored(true)} />) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 2, width: '100%', height: '100%' }}>{pattern.map((filled, index) => <div key={index} style={{ background: filled ? accent : '#fff' }} />)}</div>)}</div><div style={{ textAlign: 'center', fontSize: 12 }}>{String(node.props.codeLabel ?? 'Scan me')}</div></div></div>;
}
export function renderQrCodeStage(node: WidgetNode, ctx: RenderContext): JSX.Element { const collapsed=renderCollapsedIfNeeded(node,ctx); if(collapsed) return collapsed; return <QrCodeModuleRenderer node={node} ctx={ctx}/>; }
