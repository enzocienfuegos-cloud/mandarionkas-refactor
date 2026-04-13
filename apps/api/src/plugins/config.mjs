import { readApiEnv, validateApiEnv } from '../../../../packages/config/src/env.mjs';

const env = readApiEnv();
const warnings = validateApiEnv(env);

export function getApiConfig() {
  return { env, warnings };
}
