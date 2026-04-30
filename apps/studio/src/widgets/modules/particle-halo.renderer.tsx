import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

function HaloRing({
  size,
  radius,
  colorA,
  colorB,
  pulseMs,
  count,
}: {
  size: number;
  radius: number;
  colorA: string;
  colorB: string;
  pulseMs: number;
  count: number;
}): JSX.Element {
  const sparks = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * 360;
    const delay = `${-(index * pulseMs) / Math.max(count, 1)}ms`;
    return (
      <span
        key={index}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 6,
          height: 6,
          marginLeft: -3,
          marginTop: -3,
          borderRadius: '50%',
          background: colorA,
          boxShadow: `0 0 10px ${colorB}`,
          transformOrigin: '0 0',
          transform: `rotate(${angle}deg) translateX(${radius}px)`,
          animation: `smx-particle-orbit ${pulseMs}ms linear infinite`,
          animationDelay: delay,
        }}
      />
    );
  });

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <style>
        {`
          @keyframes smx-particle-pulse {
            0%, 100% { transform: scale(1); opacity: 0.9; }
            50% { transform: scale(1.12); opacity: 0.6; }
          }
          @keyframes smx-particle-orbit {
            0% { opacity: 0.95; }
            50% { opacity: 0.35; }
            100% { opacity: 0.95; }
          }
        `}
      </style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colorA}55 15%, ${colorB}33 45%, transparent 72%)`,
          animation: `smx-particle-pulse ${pulseMs}ms ease-in-out infinite`,
        }}
      />
      {sparks}
    </div>
  );
}

function ParticleHaloRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const size = Math.max(40, Number(node.props.size ?? 160));
  const radius = Math.max(12, Number(node.props.radius ?? 64));
  const count = Math.max(4, Math.min(32, Number(node.props.count ?? 12)));
  const pulseMs = Math.max(400, Number(node.props.pulseMs ?? 1800));
  const colorA = String(node.props.colorA ?? '#ffffff');
  const colorB = String(node.props.colorB ?? '#00c9ff');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <HaloRing size={size} radius={radius} colorA={colorA} colorB={colorB} pulseMs={pulseMs} count={count} />
    </div>
  );
}

export function renderParticleHaloStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ParticleHaloRenderer node={node} ctx={ctx} />;
}
