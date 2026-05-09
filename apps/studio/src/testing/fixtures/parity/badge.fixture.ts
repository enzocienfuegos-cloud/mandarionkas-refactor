import type { ParitySpec } from '../../parity/parity-runner';
import { createParityDocument } from './helpers';

const badgeFixture = createParityDocument('badge', {
  props: { text: 'Limited drop', icon: '⚡' },
  style: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 800,
    backgroundColor: '#7c3aed',
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});

export const badgeParitySpec: ParitySpec = {
  moduleType: 'badge',
  fixtures: [
    {
      name: 'preserves badge copy and icon',
      ...badgeFixture,
    },
  ],
};
