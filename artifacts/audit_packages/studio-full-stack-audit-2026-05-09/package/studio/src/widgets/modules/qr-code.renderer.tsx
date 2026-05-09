// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useMemo, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { buildQrPattern, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded, getAccent } from './shared-styles';

const qrCodeBodyStyle: CSSProperties = {
  ...moduleBody,
  alignItems: 'center',
  justifyContent: 'center',
};

const qrCodeFrameBaseStyle: CSSProperties = {
  borderRadius: 14,
  background: 'var(--surface-card-light)',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
};

const qrCodeImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  borderRadius: 8,
};

const qrCodePatternGridBaseStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(9, 1fr)',
  gap: 2,
  width: '100%',
  height: '100%',
};

const qrCodeLabelStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: 12,
};

function buildQrCodeFrameStyle(qrSize: number, qrPadding: number): CSSProperties {
  return {
    ...qrCodeFrameBaseStyle,
    width: qrSize,
    height: qrSize,
    padding: qrPadding,
  };
}

function buildQrCodePatternCellStyle(filled: boolean, accent: string): CSSProperties {
  return {
    background: filled ? accent : 'var(--surface-card-light)',
  };
}

function QrCodeModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const url = String(node.props.url ?? 'https://example.com');
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const [errored, setErrored] = useState(false);
  const pattern = useMemo(() => buildQrPattern(url), [url]);
  const qrScale = Math.max(0.3, Math.min(1, Number(node.props.qrScale ?? 0.72)));
  const qrPadding = Math.max(0, Number(node.props.qrPadding ?? 8));
  const qrSize = Math.max(72, Math.min(node.frame.width, node.frame.height - 24) * qrScale);

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={qrCodeBodyStyle}>
        <div style={buildQrCodeFrameStyle(qrSize, qrPadding)}>
          {!errored ? (
            <img
              src={qrUrl}
              alt={String(node.props.codeLabel ?? 'QR code')}
              style={qrCodeImageStyle}
              onError={() => setErrored(true)}
            />
          ) : (
            <div style={qrCodePatternGridBaseStyle}>
              {pattern.map((filled, index) => <div key={index} style={buildQrCodePatternCellStyle(filled, accent)} />)}
            </div>
          )}
        </div>
        <div style={qrCodeLabelStyle}>{String(node.props.codeLabel ?? 'Scan me')}</div>
      </div>
    </div>
  );
}

export function renderQrCodeStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <QrCodeModuleRenderer node={node} ctx={ctx} />;
}
