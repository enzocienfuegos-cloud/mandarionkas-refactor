import type { ParitySpec } from '../../parity/parity-runner';
import { createParityDocument } from './helpers';

const ctaFixture = createParityDocument('cta', {
  props: { text: 'Shop now', url: 'https://example.com/deal' },
  style: { backgroundColor: '#ffd400', color: '#10161c', fontSize: 24, fontWeight: 700 },
});

export const ctaParitySpec: ParitySpec = {
  moduleType: 'cta',
  fixtures: [
    {
      name: 'preserves cta label and visual weight',
      ...ctaFixture,
    },
  ],
};
