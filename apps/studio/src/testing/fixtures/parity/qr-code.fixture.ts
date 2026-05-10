import type { ParitySpec } from '../../parity/parity-runner';
import { createParityDocument } from './helpers';

const qrFixture = createParityDocument('qr-code', {
  props: {
    title: 'QR Code',
    url: 'https://example.com/scan',
    codeLabel: 'Scan me',
    qrScale: 0.72,
    qrPadding: 8,
  },
  style: { backgroundColor: '#ffffff', accentColor: '#111827', color: '#111827' },
});

export const qrCodeParitySpec: ParitySpec = {
  moduleType: 'qr-code',
  fixtures: [
    {
      name: 'preserves qr destination semantics',
      ...qrFixture,
    },
  ],
};
