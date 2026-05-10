import { useEffect, useState, type CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { clamp, moduleShellEdit } from './shared-styles';
import { VERTICAL_ACCORDION_DEFAULTS, VERTICAL_ACCORDION_ROW_DEFAULTS, type VerticalAccordionRowIndex } from './vertical-accordion.shared';

type RowConfig = {
  title: string;
  chip: string;
  src: string;
  bg: string;
  textColor: string;
};

const accordionRowShellBaseStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  transition: 'height 0.5s cubic-bezier(0.77,0,0.18,1)',
  flexShrink: 0,
};

const accordionRowHeroBaseStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  overflow: 'hidden',
  transition: 'opacity 0.4s ease 0.1s',
};

const accordionRowImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none',
};

const accordionRowImageFallbackStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  fontSize: 11,
  opacity: 0.35,
};

const accordionRowChipWrapBaseStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  padding: '0 14px',
  transition: 'opacity 0.3s ease 0.15s',
  pointerEvents: 'none',
};

const accordionRowChipStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  color: '#ffffff',
  textShadow: '0 1px 4px rgba(0,0,0,0.75)',
  lineHeight: 1.2,
};

const accordionRowStripBaseStyle: CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  cursor: 'pointer',
  zIndex: 10,
  userSelect: 'none',
};

const accordionRowTitleBaseStyle: CSSProperties = {
  flex: 1,
  fontSize: 20,
  fontWeight: 900,
  textTransform: 'uppercase',
  lineHeight: 1.1,
  letterSpacing: '-0.3px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const accordionRowChevronBaseStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'transform 0.4s ease',
  opacity: 0.7,
};

const verticalAccordionPreviewShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#0a0a0a',
};

const verticalAccordionEditorShellStyle: CSSProperties = {
  background: '#0a0a0a',
  flexDirection: 'column',
};

const verticalAccordionTopbarStyle: CSSProperties = {
  flexShrink: 0,
  background: '#0a0a0a',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  zIndex: 100,
};

const verticalAccordionTopbarBrandRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const verticalAccordionTopbarLogoStyle: CSSProperties = {
  width: 28,
  height: 28,
  objectFit: 'contain',
  flexShrink: 0,
};

const verticalAccordionTopbarTitleStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '0.04em',
  lineHeight: 1.2,
  textTransform: 'uppercase',
};

const verticalAccordionTopbarSubtitleStyle: CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: '0.15em',
  color: 'rgba(255,255,255,0.55)',
};

const verticalAccordionScrollAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  position: 'relative',
  scrollbarWidth: 'none',
};

const verticalAccordionDotsWrapStyle: CSSProperties = {
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
};

const verticalAccordionDotBaseStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
  transition: 'background 0.3s ease',
  flexShrink: 0,
};

const verticalAccordionEndcardBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 80,
  padding: '20px 16px',
  position: 'relative',
  overflow: 'hidden',
};

const verticalAccordionEndcardTitleBaseStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  textTransform: 'uppercase',
  textAlign: 'center',
  lineHeight: 1.1,
  letterSpacing: '0.03em',
};

const verticalAccordionEndcardSubtitleBaseStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  marginTop: 6,
  opacity: 0.65,
};

const verticalAccordionCtaBarBaseStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  userSelect: 'none',
};

const verticalAccordionCtaLabelBaseStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  pointerEvents: 'none',
};

function buildAccordionRowShellStyle(isExpanded: boolean, expandedHeight: number, stripHeight: number): CSSProperties {
  return {
    ...accordionRowShellBaseStyle,
    height: isExpanded ? expandedHeight : stripHeight,
  };
}

function buildAccordionRowHeroStyle(bg: string, heroHeight: number, isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowHeroBaseStyle,
    height: heroHeight,
    opacity: isExpanded ? 1 : 0,
    background: bg,
  };
}

function buildAccordionRowChipWrapStyle(stripHeight: number, isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowChipWrapBaseStyle,
    bottom: stripHeight + 2,
    opacity: isExpanded ? 1 : 0,
  };
}

function buildAccordionRowStripStyle(bg: string, stripHeight: number): CSSProperties {
  return {
    ...accordionRowStripBaseStyle,
    height: stripHeight,
    background: bg,
  };
}

function buildAccordionRowTitleStyle(textColor: string): CSSProperties {
  return {
    ...accordionRowTitleBaseStyle,
    color: textColor,
  };
}

function buildAccordionRowChevronStyle(isExpanded: boolean): CSSProperties {
  return {
    ...accordionRowChevronBaseStyle,
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
  };
}

function buildVerticalAccordionShellStyle(node: WidgetNode, ctx: RenderContext): CSSProperties {
  if (ctx.previewMode) {
    return {
      ...verticalAccordionPreviewShellStyle,
      opacity: Number(node.style.opacity ?? 1),
    };
  }

  return {
    ...moduleShellEdit(node),
    ...verticalAccordionEditorShellStyle,
  };
}

function buildVerticalAccordionTopbarStyle(height: number): CSSProperties {
  return {
    ...verticalAccordionTopbarStyle,
    height,
  };
}

function buildVerticalAccordionDotStyle(isActive: boolean): CSSProperties {
  return {
    ...verticalAccordionDotBaseStyle,
    background: isActive ? '#ffffff' : 'rgba(255,255,255,0.35)',
  };
}

function buildVerticalAccordionEndcardStyle(background: string): CSSProperties {
  return {
    ...verticalAccordionEndcardBaseStyle,
    background,
  };
}

function buildVerticalAccordionEndcardTextStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionEndcardTitleBaseStyle,
    color,
  };
}

function buildVerticalAccordionEndcardSubtitleStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionEndcardSubtitleBaseStyle,
    color,
  };
}

function buildVerticalAccordionCtaBarStyle(height: number, background: string): CSSProperties {
  return {
    ...verticalAccordionCtaBarBaseStyle,
    height,
    background,
  };
}

function buildVerticalAccordionCtaLabelStyle(color: string): CSSProperties {
  return {
    ...verticalAccordionCtaLabelBaseStyle,
    color,
  };
}

function readRow(node: WidgetNode, rowNumber: VerticalAccordionRowIndex): RowConfig {
  return {
    title: String(node.props[`row${rowNumber}Title`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].title),
    chip: String(node.props[`row${rowNumber}Chip`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].chip),
    src: String(node.props[`row${rowNumber}Src`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].src),
    bg: String(node.props[`row${rowNumber}Bg`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].bg),
    textColor: String(node.props[`row${rowNumber}TextColor`] ?? VERTICAL_ACCORDION_ROW_DEFAULTS[rowNumber].textColor),
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
    <div style={buildAccordionRowShellStyle(isExpanded, expandedHeight, stripHeight)}>
      <div style={buildAccordionRowHeroStyle(row.bg, heroHeight, isExpanded)}>
        {row.src ? (
          <img src={row.src} alt={row.title} style={accordionRowImageStyle} draggable={false} />
        ) : (
          <div style={accordionRowImageFallbackStyle}>No image</div>
        )}
      </div>

      {row.chip ? (
        <div style={buildAccordionRowChipWrapStyle(stripHeight, isExpanded)}>
          <span style={accordionRowChipStyle}>{row.chip}</span>
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
        style={buildAccordionRowStripStyle(row.bg, stripHeight)}
      >
        <div style={buildAccordionRowTitleStyle(row.textColor)}>{row.title}</div>
        <div style={buildAccordionRowChevronStyle(isExpanded)}>
          <ChevronIcon color={row.textColor} />
        </div>
      </div>
    </div>
  );
}

function VerticalAccordionRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const showTopbar = Boolean(node.props.showTopbar ?? VERTICAL_ACCORDION_DEFAULTS.showTopbar);
  const showEndcard = Boolean(node.props.showEndcard ?? VERTICAL_ACCORDION_DEFAULTS.showEndcard);
  const showDots = Boolean(node.props.showDots ?? VERTICAL_ACCORDION_DEFAULTS.showDots);
  const autoplay = Boolean(node.props.autoplay ?? VERTICAL_ACCORDION_DEFAULTS.autoplay);
  const autoplayIntervalMs = clamp(Number(node.props.autoplayIntervalMs ?? VERTICAL_ACCORDION_DEFAULTS.autoplayIntervalMs), 400, 8000);
  const stripHeight = clamp(Number(node.props.stripHeight ?? VERTICAL_ACCORDION_DEFAULTS.stripHeight), 36, 80);
  const expandedHeight = clamp(Number(node.props.expandedHeight ?? VERTICAL_ACCORDION_DEFAULTS.expandedHeight), 100, 420);

  const topbarHeight = showTopbar ? 44 : 0;
  const ctaBarHeight = 48;
  const logoSrc = String(node.props.logoSrc ?? '');
  const brandLine1 = String(node.props.brandLine1 ?? VERTICAL_ACCORDION_DEFAULTS.brandLine1);
  const brandLine2 = String(node.props.brandLine2 ?? VERTICAL_ACCORDION_DEFAULTS.brandLine2);
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

  const endcardTextColor = String(node.props.endcardTextColor ?? VERTICAL_ACCORDION_DEFAULTS.endcardTextColor);

  return (
    <div style={buildVerticalAccordionShellStyle(node, ctx)}>
      {showTopbar ? (
        <div style={buildVerticalAccordionTopbarStyle(topbarHeight)}>
          <div style={verticalAccordionTopbarBrandRowStyle}>
            {logoSrc ? <img src={logoSrc} alt={brandLine1} style={verticalAccordionTopbarLogoStyle} /> : null}
            <div style={verticalAccordionTopbarTitleStyle}>
              {brandLine1}
              {brandLine2 ? <span style={verticalAccordionTopbarSubtitleStyle}>{brandLine2}</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div style={verticalAccordionScrollAreaStyle}>
        {showDots && autoplayActive ? (
          <div style={verticalAccordionDotsWrapStyle}>
            {rows.map((_, index) => (
              <div key={index} style={buildVerticalAccordionDotStyle(index === expandedIndex)} />
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
          <div style={buildVerticalAccordionEndcardStyle(String(node.props.endcardBg ?? VERTICAL_ACCORDION_DEFAULTS.endcardBg))}>
            <div style={buildVerticalAccordionEndcardTextStyle(endcardTextColor)}>{String(node.props.endcardLine1 ?? VERTICAL_ACCORDION_DEFAULTS.endcardLine1)}</div>
            {node.props.endcardLine2 ? (
              <div style={buildVerticalAccordionEndcardSubtitleStyle(endcardTextColor)}>{String(node.props.endcardLine2)}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={String(node.props.ctaText ?? VERTICAL_ACCORDION_DEFAULTS.ctaText)}
        onClick={() => ctx.triggerWidgetAction('click')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') ctx.triggerWidgetAction('click');
        }}
        style={buildVerticalAccordionCtaBarStyle(ctaBarHeight, String(node.props.ctaBg ?? VERTICAL_ACCORDION_DEFAULTS.ctaBg))}
      >
        <span style={buildVerticalAccordionCtaLabelStyle(String(node.props.ctaTextColor ?? VERTICAL_ACCORDION_DEFAULTS.ctaTextColor))}>
          {String(node.props.ctaText ?? VERTICAL_ACCORDION_DEFAULTS.ctaText)}
        </span>
      </div>
    </div>
  );
}

export function renderVerticalAccordionStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <VerticalAccordionRenderer node={node} ctx={ctx} />;
}
