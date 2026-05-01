import { readApiEnv, validateApiEnv } from '@smx/config/src/env.mjs';

const env = readApiEnv();
const warnings = validateApiEnv(env);

export function getApiConfig() {
  return { env, warnings };
}
