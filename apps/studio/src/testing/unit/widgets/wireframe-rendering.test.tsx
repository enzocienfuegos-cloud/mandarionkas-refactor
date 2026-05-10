import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defaultWireframe } from '../../../canvas/stage/render-widget';
import { textDefinition } from '../../../widgets/text/text.definition';

describe('widget wireframe rendering', () => {
  it('renders a default label and current dimensions', () => {
    const node = textDefinition.defaults('scene_1', 1);
    node.frame = { ...node.frame, width: 180.2, height: 72.4 };

    const markup = renderToStaticMarkup(defaultWireframe(node, textDefinition));

    expect(markup).toContain('widget-wireframe');
    expect(markup).toContain('Text');
    expect(markup).toContain('180');
    expect(markup).toContain('72');
  });
});
