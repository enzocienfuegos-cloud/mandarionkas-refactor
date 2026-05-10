import { createElement } from 'react';
import { createModuleDefinition } from '../module-definition-factory';
import { renderFourFacesStage } from '../four-faces.renderer';
import { FourFacesInspector } from '../four-faces.inspector';
import { FOUR_FACES_DEFAULT_PROPS } from '../four-faces.shared';
import { FourFacesThumb } from '../../registry/widget-thumbnails';

export const FourFacesDefinition = createModuleDefinition({
  type: 'four-faces',
  label: 'Four Faces',
  category: 'interactive',
  thumbnail: FourFacesThumb,
  frame: { x: 40, y: 40, width: 320, height: 480, rotation: 0 },
  props: FOUR_FACES_DEFAULT_PROPS,
  style: {
    backgroundColor: '#F2F2F2',
    color: '#1a1a1a',
    borderRadius: 0,
    opacity: 1,
  },
  renderStage: renderFourFacesStage,
  renderInspector: (node) => createElement(FourFacesInspector, { node }),
  exportDetail: 'Full-page interactive 4-face swipe ad',
  buildPortableExport: (node) => ({
    props: {
      exportRole: 'four-faces',
      accentColor: String(node.props.accentColor ?? ''),
      home: JSON.stringify({
        brandName: node.props.brandName,
        logoSrc: node.props.logoSrc,
        title: node.props.homeTitle,
        subtitle: node.props.homeSubtitle,
        hintText: node.props.homeHintText,
        ctaLabel: node.props.homeCtaLabel,
        ctaUrl: node.props.homeCtaUrl,
        heroSrc: node.props.heroSrc,
        homeBg: node.props.homeBg,
      }),
      faces: JSON.stringify([
        { dir: 'up', title: node.props.upTitle, body: node.props.upBody, src: node.props.upImageSrc, ctaLabel: node.props.upCtaLabel, ctaUrl: node.props.upCtaUrl },
        { dir: 'down', title: node.props.downTitle, body: node.props.downBody, src: node.props.downImageSrc, ctaLabel: node.props.downCtaLabel, ctaUrl: node.props.downCtaUrl },
        { dir: 'left', title: node.props.leftTitle, body: node.props.leftBody, src: node.props.leftImageSrc, ctaLabel: node.props.leftCtaLabel, ctaUrl: node.props.leftCtaUrl },
        { dir: 'right', title: node.props.rightTitle, body: node.props.rightBody, src: node.props.rightImageSrc, ctaLabel: node.props.rightCtaLabel, ctaUrl: node.props.rightCtaUrl },
      ]),
    },
  }),
});
