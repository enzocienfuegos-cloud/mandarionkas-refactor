import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildProductionReadinessReport } from './production-readiness-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

function pickAreas(items, status) {
  return items.filter((item) => item.status === status).map((item) => item.area || item.name);
}

function evaluate(report) {
  const blockedConfig = pickAreas(report.configuration, 'blocked');
  const warningConfig = pickAreas(report.configuration, 'warning');
  const warningCoverage = pickAreas(report.automatedCoverage, 'warning');
  const warningGaps = pickAreas(report.knownGaps, 'warning');

  let verdict = 'go';
  if (blockedConfig.length > 0) {
    verdict = 'no-go';
  } else if (warningCoverage.length > 0 || warningGaps.length > 0 || warningConfig.length > 0) {
    verdict = 'conditional';
  }

  const summaryTable = [
    { area: 'configuration', status: report.summary.configuration },
    { area: 'automation', status: report.summary.automatedCoverage },
    { area: 'known-gaps', status: report.summary.knownGaps },
    { area: 'risk-signals', status: report.summary.riskSignals },
  ];

  const nextActions = [];
  if (verdict === 'no-go') {
    nextActions.push('Fill all blocked configuration items before attempting staging or production cutover.');
  }
  if (warningCoverage.includes('tenant-mutations-rehearsal')) {
    nextActions.push('Configure a smoke-only tenant/prefix and enable `STAGING_TENANT_MUTATION_REHEARSAL_ALLOW=true` to fully cover tenant mutations.');
  }
  if (verdict !== 'no-go') {
    nextActions.push('Run post-deploy check, acceptance matrix, staging smoke, and snapshot compare in the real staging environment.');
  }

  return {
    evaluatedAt: new Date().toISOString(),
    verdict,
    summaryTable,
    blockedConfig,
    warningConfig,
    warningCoverage,
    warningGaps,
    recommendation: verdict === 'go'
      ? 'Go candidate. Execute the full staging cutover sequence and monitor observability during the window.'
      : verdict === 'conditional'
        ? 'Conditional go. The platform is close, but the remaining warnings should be consciously accepted for the target environment.'
        : 'No-go. Configuration is still incomplete for a real cutover.',
    nextActions,
  };
}

const report = buildProductionReadinessReport();
const evaluation = evaluate(report);

console.log(JSON.stringify({
  ok: evaluation.verdict !== 'no-go',
  evaluation,
  report,
}, null, 2));

if (evaluation.verdict === 'no-go') process.exit(1);
