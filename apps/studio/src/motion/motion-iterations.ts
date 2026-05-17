export type MotionIterationConfig = Record<string, number | string>;

export function resolveMotionIterations(
  config: MotionIterationConfig,
  fallback: number | 'infinite',
): number | 'infinite' {
  if (fallback === 'infinite') return 'infinite';

  const repeatMode = typeof config.repeatMode === 'string'
    ? config.repeatMode.trim().toLowerCase()
    : '';
  if (repeatMode === 'repeat' || repeatMode === 'loop' || repeatMode === 'infinite') {
    return 'infinite';
  }

  if (config.iterations === 'infinite') {
    return 'infinite';
  }

  const numeric = typeof config.iterations === 'number'
    ? config.iterations
    : typeof config.iterations === 'string'
      ? Number(config.iterations)
      : Number.NaN;
  const iterations = Number.isFinite(numeric) ? numeric : fallback;

  return Math.max(1, Math.floor(iterations));
}
