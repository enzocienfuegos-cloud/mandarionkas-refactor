import type { ParitySpec } from '../../parity/parity-runner';
import { createParityDocument } from './helpers';

const imageFixture = createParityDocument('image', {
  props: { src: 'https://cdn.example.com/card.png', alt: 'Product card' },
  style: { backgroundColor: '#324454', fit: 'cover', borderRadius: 12 },
});

export const imageParitySpec: ParitySpec = {
  moduleType: 'image',
  fixtures: [
    {
      name: 'preserves asset source and alt text',
      ...imageFixture,
    },
  ],
};
