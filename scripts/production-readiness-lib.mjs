function envValue(name) {
  return String(process.env[name] || '').trim();
}

function envState(name, { required = false, expected = '', validate } = {}) {
  const value = envValue(name);
  if (!value) {
    return {
      name,
      status: required ? 'blocked' : 'warning',
      detail: required ? 'missing' : 'unset',
    };
  }
  if (expected && value !== expected) {
    return {
      name,
      status: 'blocked',
      detail: `expected "${expected}", got "${value}"`,
    };
  }
  if (typeof validate === 'function') {
    const message = validate(value);
    if (message) {
      return {
        name,
        status: 'blocked',
        detail: message,
      };
    }
  }
  return {
    name,
    status: 'ready',
    detail: 'set',
  };
}

export function summarizeArea(items) {
  if (items.some((item) => item.status === 'blocked')) return 'blocked';
  if (items.some((item) => item.status === 'warning')) return 'warning';
  return 'ready';
}

export function buildProductionReadinessReport() {
  const tenantMutationEnabled = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_ALLOW || 'false').trim() === 'true';
  const uploadCompletionInAcceptance = String(process.env.STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION || 'false').trim() === 'true';

  const configuration = [
    envState('PLATFORM_REPOSITORY_DRIVER', { required: true, expected: 'postgres' }),
    envState('PLATFORM_POSTGRES_URL', {
      required: true,
      validate: (value) => /^postgres(ql)?:\/\//i.test(value) ? '' : 'must be a postgres:// or postgresql:// URL',
    }),
    envState('PLATFORM_POSTGRES_SCHEMA', { required: true }),
    envState('PLATFORM_ALLOWED_ORIGIN', {
      required: true,
      validate: (value) => /^https:\/\//i.test(value) ? '' : 'should use https:// in staging/production',
    }),
    envState('R2_ACCESS_KEY_ID', { required: true }),
    envState('R2_SECRET_ACCESS_KEY', { required: true }),
    envState('R2_BUCKET', { required: true }),
    envState('R2_ENDPOINT', { required: true }),
    envState('R2_PUBLIC_BASE', { required: true }),
    envState('SMOKE_BASE_URL', { required: true }),
    envState('SMOKE_LOGIN_EMAIL', { required: true }),
    envState('SMOKE_LOGIN_PASSWORD', { required: true }),
    envState('STAGING_EXPECTED_REPOSITORY_DRIVER', { required: false, expected: 'postgres' }),
  ];

  const automatedCoverage = [
    { area: 'preflight', status: 'ready', detail: 'npm run db:postgres:preflight' },
    { area: 'migrations', status: 'ready', detail: 'npm run db:postgres:migrate' },
    { area: 'repository-readiness', status: 'ready', detail: 'npm run db:postgres:ready' },
    { area: 'post-deploy-check', status: 'ready', detail: 'npm run staging:post-deploy:check' },
    { area: 'upload-completion-rehearsal', status: 'ready', detail: 'npm run staging:upload-completion:rehearsal' },
    {
      area: 'tenant-mutations-rehearsal',
      status: tenantMutationEnabled ? 'ready' : 'warning',
      detail: tenantMutationEnabled
        ? 'npm run staging:tenant-mutations:rehearsal'
        : 'tenant mutation rehearsal is available but intentionally disabled until a smoke-only tenant/prefix is configured',
    },
    { area: 'acceptance-matrix', status: 'ready', detail: 'npm run staging:acceptance:matrix' },
    { area: 'staging-smoke', status: 'ready', detail: 'npm run staging:platform:smoke' },
    { area: 'snapshot-compare', status: 'ready', detail: 'npm run platform:snapshot:export && npm run platform:snapshot:compare' },
  ];

  const knownGaps = [
    {
      area: 'manual-save',
      status: 'ready',
      detail: 'manual-save is now covered by acceptance automation through save/load/exists/delete',
    },
    {
      area: 'upload-completion',
      status: 'ready',
      detail: uploadCompletionInAcceptance
        ? 'binary upload completion is covered both by acceptance automation and by a dedicated rehearsal runner'
        : 'binary upload completion is covered by a dedicated rehearsal runner, even if the full acceptance matrix path is disabled',
    },
    {
      area: 'client-membership-mutations',
      status: tenantMutationEnabled ? 'ready' : 'warning',
      detail: tenantMutationEnabled
        ? 'client/brand/invite mutations are covered by a smoke-only tenant rehearsal runner'
        : 'brand creation, invitations and membership changes are intentionally gated until a smoke-only tenant/prefix is configured',
    },
  ];

  const riskSignals = [
    {
      area: 'core-domain-automation',
      status: 'ready',
      detail: 'auth, projects, drafts, assets and admin diagnostics are covered by automated checks',
    },
    {
      area: 'production-cutover-decision',
      status: summarizeArea([...configuration, ...knownGaps]),
      detail: 'use this report plus staging execution results as the final go/no-go input',
    },
  ];

  return {
    ok: summarizeArea([...configuration, ...knownGaps.filter((item) => item.status === 'blocked')]) !== 'blocked',
    generatedAt: new Date().toISOString(),
    summary: {
      configuration: summarizeArea(configuration),
      automatedCoverage: summarizeArea(automatedCoverage),
      knownGaps: summarizeArea(knownGaps),
      riskSignals: summarizeArea(riskSignals),
    },
    configuration,
    automatedCoverage,
    knownGaps,
    riskSignals,
    recommendation: summarizeArea(configuration) === 'ready'
      ? 'Config looks cutover-capable. Finish staging checks, then review the known gaps before any production switch.'
      : 'Environment/config is not production-ready yet. Fix blocked configuration items before attempting a cutover.',
  };
}
