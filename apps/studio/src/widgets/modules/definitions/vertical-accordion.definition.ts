import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderVerticalAccordionStage } from '../vertical-accordion.renderer';
import { VerticalAccordionInspector } from '../vertical-accordion.inspector';
import { VERTICAL_ACCORDION_DEFAULT_PROPS, VERTICAL_ACCORDION_DEFAULTS } from '../vertical-accordion.shared';
import { VerticalAccordionThumb } from '../../registry/widget-thumbnails';

export const VerticalAccordionDefinition = createModuleDefinition({
  type: 'vertical-accordion',
  label: 'Vertical Accordion',
  category: 'interactive',
  thumbnail: VerticalAccordionThumb,
  frame: { x: 40, y: 40, width: 320, height: 480, rotation: 0 },
  props: VERTICAL_ACCORDION_DEFAULT_PROPS,
  style: {
    backgroundColor: VERTICAL_ACCORDION_DEFAULTS.backgroundColor,
    color: VERTICAL_ACCORDION_DEFAULTS.color,
    borderRadius: 0,
    opacity: 1,
    modulePreset: 'glass',
  },
  renderStage: renderVerticalAccordionStage,
  renderInspector: (node) => createElement(VerticalAccordionInspector, { node }),
  exportDetail: 'Vertical accordion with 3 expandable image rows',
  buildPortableExport: (node) => ({
    props: {
      exportRole: 'vertical-accordion',
      rows: JSON.stringify([
        { title: node.props.row1Title, src: node.props.row1Src, bg: node.props.row1Bg },
        { title: node.props.row2Title, src: node.props.row2Src, bg: node.props.row2Bg },
        { title: node.props.row3Title, src: node.props.row3Src, bg: node.props.row3Bg },
      ]),
      ctaText: String(node.props.ctaText ?? ''),
      ctaUrl: String(node.props.ctaUrl ?? ''),
    },
  }),
});
