import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const checks = [
  { name: 'PLATFORM_REPOSITORY_DRIVER', requiredValue: 'postgres' },
  { name: 'PLATFORM_POSTGRES_URL' },
  { name: 'PLATFORM_POSTGRES_SCHEMA' },
  { name: 'PLATFORM_ALLOWED_ORIGIN' },
  { name: 'R2_ACCESS_KEY_ID' },
  { name: 'R2_SECRET_ACCESS_KEY' },
  { name: 'R2_BUCKET' },
  { name: 'R2_ENDPOINT' },
  { name: 'R2_PUBLIC_BASE' },
];

const failures = [];
const summary = {};

for (const check of checks) {
  const value = String(process.env[check.name] || '').trim();
  summary[check.name] = value ? '[set]' : '[missing]';
  if (!value) {
    failures.push(`${check.name} is required`);
    continue;
  }
  if (check.requiredValue && value !== check.requiredValue) {
    failures.push(`${check.name} must be "${check.requiredValue}"`);
  }
}

const postgresUrl = String(process.env.PLATFORM_POSTGRES_URL || '').trim();
if (postgresUrl && !/^postgres(ql)?:\/\//i.test(postgresUrl)) {
  failures.push('PLATFORM_POSTGRES_URL must be a valid postgres:// or postgresql:// URL');
}

const allowedOrigin = String(process.env.PLATFORM_ALLOWED_ORIGIN || '').trim();
if (allowedOrigin && !/^https:\/\//i.test(allowedOrigin)) {
  failures.push('PLATFORM_ALLOWED_ORIGIN should use https:// in staging/production');
}

const result = {
  ok: failures.length === 0,
  summary,
  failures,
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
