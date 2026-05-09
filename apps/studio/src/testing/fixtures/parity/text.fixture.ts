import type { ParitySpec } from '../../parity/parity-runner';
import { createParityDocument } from './helpers';

const textFixture = createParityDocument('text', {
  props: { text: 'Parity headline' },
  style: { color: '#ffffff', fontSize: 28, fontWeight: 700, textAlign: 'center' },
});

export const textParitySpec: ParitySpec = {
  moduleType: 'text',
  fixtures: [
    {
      name: 'renders the same headline semantics',
      ...textFixture,
    },
  ],
};
