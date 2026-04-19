import { readApiEnv, validateApiEnv } from '@smx/config/env';

const env = readApiEnv();
const warnings = validateApiEnv(env);

export function getApiConfig() {
  return { env, warnings };
}
