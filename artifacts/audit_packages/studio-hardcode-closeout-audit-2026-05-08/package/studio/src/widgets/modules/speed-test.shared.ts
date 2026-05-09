export const SPEED_TEST_DEFAULT_CTA_LABEL = 'Start test';
export const SPEED_TEST_DEFAULT_FAST_MESSAGE = 'WOW, very fast network';
export const SPEED_TEST_DEFAULT_SLOW_MESSAGE = 'Slow connection';
export const SPEED_TEST_DEFAULT_PROPS = {
  title: 'Speed Test',
  min: 10,
  max: 100,
  current: 64,
  units: 'Mbps',
  skin: 'ookla',
  pingValue: 11,
  uploadValue: 42,
  durationMs: 1800,
  ctaLabel: SPEED_TEST_DEFAULT_CTA_LABEL,
  resultMode: 'random',
  fastThreshold: 70,
  fastMessage: SPEED_TEST_DEFAULT_FAST_MESSAGE,
  slowMessage: SPEED_TEST_DEFAULT_SLOW_MESSAGE,
} as const;
