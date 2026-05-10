import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

function value(name) {
  return String(process.env[name] || '').trim();
}

function isPlaceholder(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return true;
  return [
    'replace-me',
    'your-account-id',
    'your-access-key',
    'your-secret-key',
    'your-bucket',
  ].includes(normalized)
    || normalized.includes('example.com')
    || normalized.includes('example.invalid')
    || normalized.includes('db-staging.example.com')
    || normalized.includes('api-staging.example.com')
    || normalized.includes('app-staging.example.com')
    || normalized.includes('user:password@');
}

const checks = [
  { name: 'VITE_API_BASE_URL', kind: 'url' },
  { name: 'SMOKE_BASE_URL', kind: 'url' },
  { name: 'SMOKE_LOGIN_EMAIL', kind: 'email' },
  { name: 'SMOKE_LOGIN_PASSWORD', kind: 'secret' },
  { name: 'STAGING_EXPECTED_REPOSITORY_DRIVER', exact: 'postgres', optional: true },
  { name: 'SMOKE_EXPECTED_REPOSITORY_DRIVER', exact: 'postgres', optional: true },
  { name: 'PLATFORM_ALLOWED_ORIGIN', kind: 'url' },
  { name: 'PLATFORM_REPOSITORY_DRIVER', exact: 'postgres' },
  { name: 'PLATFORM_POSTGRES_URL', kind: 'postgres' },
  { name: 'PLATFORM_POSTGRES_SCHEMA', kind: 'identifier' },
  { name: 'PLATFORM_POSTGRES_SSL_MODE', oneOf: ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'], optional: true },
  { name: 'R2_ACCOUNT_ID', kind: 'text' },
  { name: 'R2_ACCESS_KEY_ID', kind: 'text' },
  { name: 'R2_SECRET_ACCESS_KEY', kind: 'secret' },
  { name: 'R2_BUCKET', kind: 'text' },
  { name: 'R2_ENDPOINT', kind: 'url' },
  { name: 'R2_PUBLIC_BASE', kind: 'url' },
];

const failures = [];
const warnings = [];
const summary = {};

for (const check of checks) {
  const current = value(check.name);
  summary[check.name] = current ? '[set]' : '[missing]';

  if (!current) {
    if (check.optional) continue;
    failures.push(`${check.name} is required`);
    continue;
  }

  if (isPlaceholder(current)) {
    failures.push(`${check.name} still looks like a placeholder`);
    continue;
  }

  if (check.exact && current !== check.exact) {
    failures.push(`${check.name} must be "${check.exact}"`);
    continue;
  }

  if (check.oneOf && !check.oneOf.includes(current)) {
    failures.push(`${check.name} must be one of: ${check.oneOf.join(', ')}`);
    continue;
  }

  if (check.kind === 'url' && !/^https?:\/\//i.test(current)) {
    failures.push(`${check.name} must be a valid http(s) URL`);
    continue;
  }

  if (check.kind === 'postgres' && !/^postgres(ql)?:\/\//i.test(current)) {
    failures.push(`${check.name} must be a valid postgres:// or postgresql:// URL`);
    continue;
  }

  if (check.kind === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(current)) {
    failures.push(`${check.name} must be a valid email`);
    continue;
  }

  if (check.kind === 'identifier' && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(current)) {
    failures.push(`${check.name} must be a valid SQL identifier`);
    continue;
  }
}

if (value('STAGING_TENANT_MUTATION_REHEARSAL_ALLOW') === 'true' && isPlaceholder(value('STAGING_TENANT_MUTATION_REHEARSAL_PREFIX'))) {
  failures.push('STAGING_TENANT_MUTATION_REHEARSAL_PREFIX must be real when tenant mutation rehearsal is enabled');
}

if (value('STAGING_TENANT_MUTATION_REHEARSAL_ALLOW') !== 'true') {
  warnings.push('Tenant mutation rehearsal remains disabled until a smoke-only tenant/prefix exists');
}

if (value('STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION') !== 'true') {
  warnings.push('Acceptance matrix will not exercise upload completion; rely on the dedicated rehearsal runner');
}

const result = {
  ok: failures.length === 0,
  summary,
  failures,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
