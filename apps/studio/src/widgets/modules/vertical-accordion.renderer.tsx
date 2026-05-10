// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useState } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import {
  buildAccordionRowChevronStyle,
  buildAccordionRowChipWrapStyle,
  buildAccordionRowHeroStyle,
  buildAccordionRowShellStyle,
  buildAccordionRowStripStyle,
  buildAccordionRowTitleStyle,
  buildVerticalAccordionCtaBarStyle,
  buildVerticalAccordionCtaLabelStyle,
  buildVerticalAccordionDotStyle,
  buildVerticalAccordionEndcardStyle,
  buildVerticalAccordionEndcardSubtitleStyle,
  buildVerticalAccordionEndcardTextStyle,
  buildVerticalAccordionShellStyle,
  buildVerticalAccordionTopbarStyle,
  verticalAccordionUi,
} from './vertical-accordion.style-recipe';
import {
  buildVerticalAccordionViewModel,
  type VerticalAccordionRowConfig,
} from './vertical-accordion.view-model';
import { createModuleViewModel } from './view-model';

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
  row: VerticalAccordionRowConfig;
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
          <img src={row.src} alt={row.title} style={verticalAccordionUi.accordionRowImageStyle} draggable={false} />
        ) : (
          <div style={verticalAccordionUi.accordionRowImageFallbackStyle}>No image</div>
        )}
      </div>

      {row.chip ? (
        <div style={buildAccordionRowChipWrapStyle(stripHeight, isExpanded)}>
          <span style={verticalAccordionUi.accordionRowChipStyle}>{row.chip}</span>
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
  const viewModel = buildVerticalAccordionViewModel(node);
  const skinVm = createModuleViewModel({
    type: node.type,
    props: {},
    style: node.style as Record<string, unknown>,
    surface: 'stage',
  }, () => ({}));
  const [expandedIndex, setExpandedIndex] = useState<number>(-1);
  const [autoplayActive, setAutoplayActive] = useState(false);

  useEffect(() => {
    if (!viewModel.autoplay || !ctx.previewMode) return;

    let step = 0;
    let timer: ReturnType<typeof window.setTimeout> | undefined;
    setAutoplayActive(true);
    setExpandedIndex(-1);

    function advance(): void {
      if (step >= viewModel.rows.length) {
        setExpandedIndex(-1);
        setAutoplayActive(false);
        return;
      }
      setExpandedIndex(step);
      step += 1;
      timer = window.setTimeout(advance, viewModel.autoplayIntervalMs);
    }

    const startTimer = window.setTimeout(advance, 400);
    return () => {
      window.clearTimeout(startTimer);
      if (timer) window.clearTimeout(timer);
      setAutoplayActive(false);
    };
  }, [ctx.previewMode, viewModel.autoplay, viewModel.autoplayIntervalMs, viewModel.rows.length]);

  function handleToggle(index: number): void {
    if (autoplayActive) setAutoplayActive(false);
    setExpandedIndex((current) => (current === index ? -1 : index));
  }

  return (
    <div style={buildVerticalAccordionShellStyle(node, ctx, skinVm.cssVars)}>
      {viewModel.showTopbar ? (
        <div style={buildVerticalAccordionTopbarStyle(viewModel.topbarHeight)}>
          <div style={verticalAccordionUi.verticalAccordionTopbarBrandRowStyle}>
            {viewModel.logoSrc ? (
              <img src={viewModel.logoSrc} alt={viewModel.brandLine1} style={verticalAccordionUi.verticalAccordionTopbarLogoStyle} />
            ) : null}
            <div style={verticalAccordionUi.verticalAccordionTopbarTitleStyle}>
              {viewModel.brandLine1}
              {viewModel.brandLine2 ? (
                <span style={verticalAccordionUi.verticalAccordionTopbarSubtitleStyle}>{viewModel.brandLine2}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div style={verticalAccordionUi.verticalAccordionScrollAreaStyle}>
        {viewModel.showDots && autoplayActive ? (
          <div style={verticalAccordionUi.verticalAccordionDotsWrapStyle}>
            {viewModel.rows.map((_, index) => (
              <div key={index} style={buildVerticalAccordionDotStyle(index === expandedIndex)} />
            ))}
          </div>
        ) : null}

        {viewModel.rows.map((row, index) => (
          <AccordionRow
            key={index}
            row={row}
            index={index}
            isExpanded={expandedIndex === index}
            stripHeight={viewModel.stripHeight}
            expandedHeight={viewModel.expandedHeight}
            onToggle={handleToggle}
          />
        ))}

        {viewModel.showEndcard ? (
          <div style={buildVerticalAccordionEndcardStyle(viewModel.endcardBg)}>
            <div style={buildVerticalAccordionEndcardTextStyle(viewModel.endcardTextColor)}>{viewModel.endcardLine1}</div>
            {viewModel.endcardLine2 ? (
              <div style={buildVerticalAccordionEndcardSubtitleStyle(viewModel.endcardTextColor)}>
                {viewModel.endcardLine2}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={viewModel.ctaText}
        onClick={() => ctx.triggerWidgetAction('click')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') ctx.triggerWidgetAction('click');
        }}
        style={buildVerticalAccordionCtaBarStyle(viewModel.ctaBarHeight, viewModel.ctaBg)}
      >
        <span style={buildVerticalAccordionCtaLabelStyle(viewModel.ctaTextColor)}>
          {viewModel.ctaText}
        </span>
      </div>
    </div>
  );
}

export function renderVerticalAccordionStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <VerticalAccordionRenderer node={node} ctx={ctx} />;
}
