import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildProductionReadinessReport, summarizeArea } from './production-readiness-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const tenantMutationEnabled = String(process.env.STAGING_TENANT_MUTATION_REHEARSAL_ALLOW || 'false').trim() === 'true';
const includeUploadCompletion = String(process.env.STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION || 'false').trim() === 'true';

function buildSteps() {
  return [
    ['Readiness', '`npm run production:readiness:evaluate`', 'Veredicto ejecutivo antes de tocar staging.'],
    ['Preflight', '`npm run db:postgres:preflight`', 'Valida PostgreSQL, R2 y smoke config.'],
    ['Migrations', '`npm run db:postgres:migrate`', 'Aplica migraciones pendientes.'],
    ['Repository Ready', '`env PLATFORM_REPOSITORY_DRIVER=postgres npm run db:postgres:ready`', 'Confirma readiness del driver PostgreSQL.'],
    ['Deploy', 'Reiniciar/deploy del API con `PLATFORM_REPOSITORY_DRIVER=postgres`', 'Cambio efectivo del driver en staging.'],
    ['Post Deploy', '`npm run staging:post-deploy:check`', 'Health, readyz, version y observability.'],
    ['Acceptance', '`npm run staging:acceptance:matrix`', includeUploadCompletion
      ? 'Cobertura por dominio, incluyendo autosave/manual-save y assets.'
      : 'Cobertura por dominio; upload completion queda separado en rehearsal dedicado.'],
    ['Smoke', '`npm run staging:platform:smoke`', 'Smoke end-to-end general.'],
    ['Upload', '`npm run staging:upload-completion:rehearsal`', 'Valida signed upload + complete-upload + purge.'],
    ['Tenant', tenantMutationEnabled
      ? '`npm run staging:tenant-mutations:rehearsal`'
      : '`npm run staging:tenant-mutations:rehearsal` (cuando exista smoke-only tenant)', tenantMutationEnabled
        ? 'Valida create client, brands e invites en tenant smoke-only.'
        : 'Opcional hasta habilitar smoke-only tenant/prefix.'],
    ['Snapshot Before', '`npm run platform:snapshot:export`', 'Captura snapshot para comparación.'],
    ['Snapshot Compare', '`npm run platform:snapshot:compare <before.json> <after.json>`', 'Compara identidad y conteos post-cutover.'],
  ];
}

function renderStatusLine(label, values) {
  if (!values.length) return `- ${label}: none`;
  return `- ${label}: ${values.join(', ')}`;
}

const report = buildProductionReadinessReport();
const blockedConfig = report.configuration.filter((item) => item.status === 'blocked').map((item) => item.name);
const warningCoverage = report.automatedCoverage.filter((item) => item.status === 'warning').map((item) => item.area);
const warningGaps = report.knownGaps.filter((item) => item.status === 'warning').map((item) => item.area);

const verdict = blockedConfig.length > 0
  ? 'NO-GO'
  : summarizeArea([...report.automatedCoverage, ...report.knownGaps]) === 'warning'
    ? 'CONDITIONAL'
    : 'GO';

const lines = [];
lines.push('# Staging Cutover Checklist');
lines.push('');
lines.push(`- Generated at: ${new Date().toISOString()}`);
lines.push(`- Verdict: ${verdict}`);
lines.push(renderStatusLine('Blocked config', blockedConfig));
lines.push(renderStatusLine('Warning coverage', warningCoverage));
lines.push(renderStatusLine('Warning gaps', warningGaps));
lines.push('');
lines.push('## Pre-Cutover');
for (const [label, command, note] of buildSteps().slice(0, 5)) {
  lines.push(`- [ ] ${label}: ${command}`);
  lines.push(`  ${note}`);
}
lines.push('');
lines.push('## Post-Deploy');
for (const [label, command, note] of buildSteps().slice(5)) {
  lines.push(`- [ ] ${label}: ${command}`);
  lines.push(`  ${note}`);
}
lines.push('');
lines.push('## Notes');
lines.push('- This cutover path is PostgreSQL-only; there is no legacy object-store fallback in the runtime anymore.');
lines.push('- Only enable tenant mutation rehearsal in a smoke-only tenant/prefix.');
lines.push('- If `staging:post-deploy:check` or `staging:platform:smoke` fail, stop and inspect `/observability` plus `/admin/audit-events` before continuing.');

console.log(lines.join('\n'));
if (verdict === 'NO-GO') process.exit(1);
