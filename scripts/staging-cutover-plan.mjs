import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildProductionReadinessReport, summarizeArea } from './production-readiness-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const tenantMutationEnabled = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_ALLOW || 'false').trim() === 'true';
const includeUploadCompletion = String(process.env.STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION || 'false').trim() === 'true';

function buildSteps(report) {
  const steps = [
    {
      id: 'readiness-evaluate',
      command: 'npm run production:readiness:evaluate',
      required: true,
      reason: 'Validate go/no-go before touching staging.',
    },
    {
      id: 'preflight',
      command: 'npm run db:postgres:preflight',
      required: true,
      reason: 'Fail fast on missing PostgreSQL/R2/smoke configuration.',
    },
    {
      id: 'migrate',
      command: 'npm run db:postgres:migrate',
      required: true,
      reason: 'Apply pending PostgreSQL migrations before switching traffic.',
    },
    {
      id: 'ready',
      command: 'env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready',
      required: true,
      reason: 'Verify repository-level readiness before deploy.',
    },
    {
      id: 'deploy',
      command: 'Deploy/restart the staging API with PLATFORM_REPOSITORY_DRIVER=postgres',
      required: true,
      reason: 'Switch staging to the PostgreSQL-backed driver.',
      manual: true,
    },
    {
      id: 'post-deploy',
      command: 'npm run staging:post-deploy:check',
      required: true,
      reason: 'Confirm health, readyz, version and observability after deploy.',
    },
    {
      id: 'acceptance',
      command: 'npm run staging:acceptance:matrix',
      required: true,
      reason: 'Validate grouped domain coverage on the live staging API.',
    },
    {
      id: 'smoke',
      command: 'npm run staging:platform:smoke',
      required: true,
      reason: 'Run end-to-end smoke on auth, projects and assets.',
    },
    {
      id: 'upload-rehearsal',
      command: 'npm run staging:upload-completion:rehearsal',
      required: true,
      reason: 'Exercise binary upload completion end-to-end.',
    },
    {
      id: 'tenant-rehearsal',
      command: 'npm run staging:tenant-mutations:rehearsal',
      required: tenantMutationEnabled,
      optionalWhenDisabled: !tenantMutationEnabled,
      reason: tenantMutationEnabled
        ? 'Validate workspace/brand/invite mutations in the smoke-only tenant.'
        : 'Available once a smoke-only tenant/prefix is configured.',
    },
    {
      id: 'snapshot-before',
      command: 'npm run platform:snapshot:export',
      required: true,
      reason: 'Capture a before/after comparison for the cutover window.',
    },
    {
      id: 'snapshot-compare',
      command: 'npm run platform:snapshot:compare <before.json> <after.json>',
      required: true,
      reason: 'Verify metadata identity and count stability after cutover.',
      manual: true,
    },
  ];

  if (!includeUploadCompletion) {
    const acceptance = steps.find((step) => step.id === 'acceptance');
    if (acceptance) {
      acceptance.reason += ' Upload completion remains covered separately by the dedicated rehearsal runner.';
    }
  }

  return steps;
}

const report = buildProductionReadinessReport();
const steps = buildSteps(report);
const blockedConfig = report.configuration.filter((item) => item.status === 'blocked').map((item) => item.name);
const warningAreas = [
  ...report.automatedCoverage.filter((item) => item.status === 'warning').map((item) => item.area),
  ...report.knownGaps.filter((item) => item.status === 'warning').map((item) => item.area),
];

const verdict = blockedConfig.length > 0
  ? 'no-go'
  : summarizeArea([...report.automatedCoverage, ...report.knownGaps]) === 'warning'
    ? 'conditional'
    : 'go';

console.log(JSON.stringify({
  ok: verdict !== 'no-go',
  generatedAt: new Date().toISOString(),
  verdict,
  blockedConfig,
  warningAreas,
  steps,
}, null, 2));

if (verdict === 'no-go') process.exit(1);
