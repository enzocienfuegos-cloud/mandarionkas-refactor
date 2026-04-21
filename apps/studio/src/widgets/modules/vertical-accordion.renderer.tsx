import { useEffect, useState } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { clamp, moduleShellEdit } from './shared-styles';

type RowConfig = {
  title: string;
  chip: string;
  src: string;
  bg: string;
  textColor: string;
};

const ROW_DEFAULTS = {
  bg: ['#004B93', '#ffffff', '#1a1a2e'],
  textColor: ['#ffffff', '#1a1a2e', '#ffffff'],
};

function readRow(node: WidgetNode, rowNumber: number): RowConfig {
  return {
    title: String(node.props[`row${rowNumber}Title`] ?? `Section ${rowNumber}`),
    chip: String(node.props[`row${rowNumber}Chip`] ?? ''),
    src: String(node.props[`row${rowNumber}Src`] ?? ''),
    bg: String(node.props[`row${rowNumber}Bg`] ?? ROW_DEFAULTS.bg[rowNumber - 1] ?? '#1a1a2e'),
    textColor: String(node.props[`row${rowNumber}TextColor`] ?? ROW_DEFAULTS.textColor[rowNumber - 1] ?? '#ffffff'),
  };
}

function ChevronIcon({ color }: { color: string }): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6l5 5 5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccordionRow({
  row,
  index,
  isExpanded,
  stripHeight,
  expandedHeight,
  onToggle,
}: {
  row: RowConfig;
  index: number;
  isExpanded: boolean;
  stripHeight: number;
  expandedHeight: number;
  onToggle: (index: number) => void;
}): JSX.Element {
  const heroHeight = expandedHeight - stripHeight;

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: isExpanded ? expandedHeight : stripHeight,
        transition: 'height 0.5s cubic-bezier(0.77,0,0.18,1)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: heroHeight,
          overflow: 'hidden',
          opacity: isExpanded ? 1 : 0,
          transition: 'opacity 0.4s ease 0.1s',
          background: row.bg,
        }}
      >
        {row.src ? (
          <img
            src={row.src}
            alt={row.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none', userSelect: 'none' }}
            draggable={false}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 11, opacity: 0.35 }}>
            No image
          </div>
        )}
      </div>

      {row.chip ? (
        <div
          style={{
            position: 'absolute',
            bottom: stripHeight + 2,
            left: 0,
            right: 0,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            opacity: isExpanded ? 1 : 0,
            transition: 'opacity 0.3s ease 0.15s',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#ffffff',
              textShadow: '0 1px 4px rgba(0,0,0,0.75)',
              lineHeight: 1.2,
            }}
          >
            {row.chip}
          </span>
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => onToggle(index)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            onToggle(index);
            event.preventDefault();
          }
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: stripHeight,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          background: row.bg,
          cursor: 'pointer',
          zIndex: 10,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            flex: 1,
            color: row.textColor,
            fontSize: 20,
            fontWeight: 900,
            textTransform: 'uppercase',
            lineHeight: 1.1,
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.title}
        </div>
        <div
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.4s ease',
            opacity: 0.7,
          }}
        >
          <ChevronIcon color={row.textColor} />
        </div>
      </div>
    </div>
  );
}

function VerticalAccordionRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const showTopbar = Boolean(node.props.showTopbar ?? true);
  const showEndcard = Boolean(node.props.showEndcard ?? true);
  const showDots = Boolean(node.props.showDots ?? true);
  const autoplay = Boolean(node.props.autoplay ?? true);
  const autoplayIntervalMs = clamp(Number(node.props.autoplayIntervalMs ?? 1000), 400, 8000);
  const stripHeight = clamp(Number(node.props.stripHeight ?? 56), 36, 80);
  const expandedHeight = clamp(Number(node.props.expandedHeight ?? 280), 100, 420);

  const topbarHeight = showTopbar ? 44 : 0;
  const ctaBarHeight = 48;
  const logoSrc = String(node.props.logoSrc ?? '');
  const brandLine1 = String(node.props.brandLine1 ?? 'Brand');
  const brandLine2 = String(node.props.brandLine2 ?? '');
  const rows: RowConfig[] = [readRow(node, 1), readRow(node, 2), readRow(node, 3)];

  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [autoplayActive, setAutoplayActive] = useState(false);

  useEffect(() => {
    if (!autoplay || !ctx.previewMode) return;

    let step = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    setAutoplayActive(true);
    setExpandedIndex(-1);

    function advance(): void {
      if (step >= rows.length) {
        setExpandedIndex(-1);
        setAutoplayActive(false);
        return;
      }
      setExpandedIndex(step);
      step += 1;
      timer = window.setTimeout(advance, autoplayIntervalMs);
    }

    const startTimer = window.setTimeout(advance, 400);
    return () => {
      window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
      setAutoplayActive(false);
    };
  }, [autoplay, autoplayIntervalMs, ctx.previewMode, rows.length]);

  function handleToggle(index: number): void {
    if (autoplayActive) setAutoplayActive(false);
    setExpandedIndex((current) => (current === index ? -1 : index));
  }

  const shellStyle = ctx.previewMode
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
        background: '#0a0a0a',
        opacity: Number(node.style.opacity ?? 1),
      }
    : {
        ...moduleShellEdit(node),
        background: '#0a0a0a',
        flexDirection: 'column' as const,
      };

  return (
    <div style={shellStyle}>
      {showTopbar ? (
        <div
          style={{
            height: topbarHeight,
            flexShrink: 0,
            background: '#0a0a0a',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {logoSrc ? <img src={logoSrc} alt={brandLine1} style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} /> : null}
            <div
              style={{
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.04em',
                lineHeight: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {brandLine1}
              {brandLine2 ? (
                <span
                  style={{
                    display: 'block',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {brandLine2}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          position: 'relative',
          scrollbarWidth: 'none',
        }}
      >
        {showDots && autoplayActive ? (
          <div
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 99,
              height: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
              paddingTop: 8,
              pointerEvents: 'none',
            }}
          >
            {rows.map((_, index) => (
              <div
                key={index}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: index === expandedIndex ? '#ffffff' : 'rgba(255,255,255,0.35)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  transition: 'background 0.3s ease',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        ) : null}

        {rows.map((row, index) => (
          <AccordionRow
            key={index}
            row={row}
            index={index}
            isExpanded={expandedIndex === index}
            stripHeight={stripHeight}
            expandedHeight={expandedHeight}
            onToggle={handleToggle}
          />
        ))}

        {showEndcard ? (
          <div
            style={{
              background: String(node.props.endcardBg ?? '#004B93'),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 80,
              padding: '20px 16px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                color: String(node.props.endcardTextColor ?? '#ffffff'),
                fontSize: 24,
                fontWeight: 900,
                textTransform: 'uppercase',
                textAlign: 'center',
                lineHeight: 1.1,
                letterSpacing: '0.03em',
              }}
            >
              {String(node.props.endcardLine1 ?? 'BRAND')}
            </div>
            {node.props.endcardLine2 ? (
              <div
                style={{
                  color: String(node.props.endcardTextColor ?? '#ffffff'),
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginTop: 6,
                  opacity: 0.65,
                }}
              >
                {String(node.props.endcardLine2)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={String(node.props.ctaText ?? 'Call to action')}
        onClick={() => ctx.triggerWidgetAction('click')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') ctx.triggerWidgetAction('click');
        }}
        style={{
          height: ctaBarHeight,
          flexShrink: 0,
          background: String(node.props.ctaBg ?? '#EE1C24'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            color: String(node.props.ctaTextColor ?? '#ffffff'),
            fontSize: 12,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            pointerEvents: 'none',
          }}
        >
          {String(node.props.ctaText ?? 'Explore All >')}
        </span>
      </div>
    </div>
  );
}

export function renderVerticalAccordionStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <VerticalAccordionRenderer node={node} ctx={ctx} />;
}
