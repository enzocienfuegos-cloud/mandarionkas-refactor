import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInspectorField, createInspectorSection } from '../../../inspector/contract-driven';

describe('contract-driven inspector helpers', () => {
  it('renders select and textarea schema fields through the shared helper', () => {
    const markup = renderToStaticMarkup(
      <div>
        {createInspectorField({
          kind: 'select',
          label: 'Target channel',
          value: 'generic-html5',
          onChange: () => undefined,
          options: [
            { label: 'generic-html5', value: 'generic-html5' },
            { label: 'mraid', value: 'mraid' },
          ],
        })}
        {createInspectorField({
          kind: 'textarea',
          label: 'Release notes',
          value: 'Ship after QA.',
          onChange: () => undefined,
        })}
      </div>,
    );

    expect(markup).toContain('Target channel');
    expect(markup).toContain('generic-html5');
    expect(markup).toContain('Release notes');
    expect(markup).toContain('Ship after QA.');
  });

  it('renders a premium section shell with heading and body', () => {
    const markup = renderToStaticMarkup(
      createInspectorSection({
        title: 'Timing',
        description: 'Timeline boundaries for the selected widget.',
        children: <div className="fields-grid"><span>body</span></div>,
      }),
    );

    expect(markup).toContain('section-premium');
    expect(markup).toContain('Timing');
    expect(markup).toContain('Timeline boundaries for the selected widget.');
    expect(markup).toContain('body');
  });
});
