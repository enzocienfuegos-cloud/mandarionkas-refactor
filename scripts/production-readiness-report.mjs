import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildProductionReadinessReport } from './production-readiness-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');
const result = buildProductionReadinessReport();

console.log(JSON.stringify(result, null, 2));
if (result.summary.configuration === 'blocked') process.exit(1);
