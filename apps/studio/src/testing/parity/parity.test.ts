import { badgeParitySpec } from '../fixtures/parity/badge.fixture';
import { ctaParitySpec } from '../fixtures/parity/cta.fixture';
import { imageParitySpec } from '../fixtures/parity/image.fixture';
import { qrCodeParitySpec } from '../fixtures/parity/qr-code.fixture';
import { textParitySpec } from '../fixtures/parity/text.fixture';
import { runParityTest } from './parity-runner';

[
  badgeParitySpec,
  ctaParitySpec,
  imageParitySpec,
  qrCodeParitySpec,
  textParitySpec,
].forEach((spec) => {
  runParityTest(spec);
});
