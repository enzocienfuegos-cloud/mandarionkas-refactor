// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useState } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import type { WidgetNode } from '../../domain/document/types';
import { usePlaybackDerivedValue } from '../../hooks/use-playback-engine';
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
          <img src={row.src} alt={row.title} decoding="async" style={verticalAccordionUi.accordionRowImageStyle} draggable={false} />
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
  const autoplayDerivedIndex = usePlaybackDerivedValue<number | null>(ctx.playheadMs, (nextMs) => {
    if (!viewModel.autoplay || !ctx.previewMode || viewModel.rows.length === 0) return null;
    const startDelayMs = 400;
    if (nextMs < startDelayMs) return -1;
    const elapsedMs = nextMs - startDelayMs;
    const step = Math.floor(elapsedMs / viewModel.autoplayIntervalMs);
    if (step >= viewModel.rows.length) return -1;
    return step;
  });
  const effectiveExpandedIndex = autoplayDerivedIndex ?? expandedIndex;
  const autoplayActive = autoplayDerivedIndex !== null && autoplayDerivedIndex >= 0;

  function handleToggle(index: number): void {
    if (autoplayDerivedIndex !== null) return;
    setExpandedIndex((current) => (current === index ? -1 : index));
  }

  return (
    <div style={buildVerticalAccordionShellStyle(node, ctx, skinVm.cssVars)}>
      {viewModel.showTopbar ? (
        <div style={buildVerticalAccordionTopbarStyle(viewModel.topbarHeight)}>
          <div style={verticalAccordionUi.verticalAccordionTopbarBrandRowStyle}>
            {viewModel.logoSrc ? (
              <img src={viewModel.logoSrc} alt={viewModel.brandLine1} decoding="async" style={verticalAccordionUi.verticalAccordionTopbarLogoStyle} />
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
            {viewModel.rows.map((_, index) => {
              return <div key={index} style={buildVerticalAccordionDotStyle(index === effectiveExpandedIndex)} />;
            })}
          </div>
        ) : null}

        {viewModel.rows.map((row, index) => (
          <AccordionRow
            key={index}
            row={row}
            index={index}
            isExpanded={effectiveExpandedIndex === index}
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
