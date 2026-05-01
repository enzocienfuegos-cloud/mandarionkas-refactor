#!/usr/bin/env node

import pg from 'pg';

const { Pool } = pg;
const DRY_RUN = !process.argv.includes('--fix');
const CONNECTION = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || '';

if (!CONNECTION) {
  console.error('ERROR: DATABASE_URL or DATABASE_POOL_URL is required.');
  process.exit(2);
}

const pool = new Pool({ connectionString: CONNECTION, ssl: { rejectUnauthorized: false }, max: 3 });

const ok = (s) => `\x1b[32m✅ ${s}\x1b[0m`;
const err = (s) => `\x1b[31m❌ ${s}\x1b[0m`;
const wrn = (s) => `\x1b[33m⚠️  ${s}\x1b[0m`;
const inf = (s) => `\x1b[36mℹ  ${s}\x1b[0m`;

let hasErrors = false;

function pass(label) {
  console.log(ok(label));
}

function fail(label, detail) {
  console.log(err(label));
  if (detail) console.log(`   ${detail}`);
  hasErrors = true;
}

function warn(label, detail) {
  console.log(wrn(label));
  if (detail) console.log(`   ${detail}`);
}

function info(label) {
  console.log(inf(label));
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function countRows(sql, params = []) {
  const { rows } = await query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

function derivePlatformRole(globalRole) {
  const value = String(globalRole || '').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'reviewer') return 'reviewer';
  if (value === 'ad_ops') return 'ad_ops';
  return 'designer';
}

const VALID_PLATFORM_ROLES = ['admin', 'designer', 'ad_ops', 'reviewer'];

async function checkNullPlatformRoles() {
  const count = await countRows('SELECT COUNT(*) FROM users WHERE platform_role IS NULL');
  if (count === 0) {
    pass('No users with NULL platform_role');
    return;
  }
  fail(`${count} users with NULL platform_role`, 'Run with --fix to auto-correct.');
  if (!DRY_RUN) {
    const { rows } = await query('SELECT id, global_role FROM users WHERE platform_role IS NULL');
    for (const row of rows) {
      const derived = derivePlatformRole(row.global_role);
      await query('UPDATE users SET platform_role = $1, updated_at = NOW() WHERE id = $2', [derived, row.id]);
    }
    pass(`Fixed ${rows.length} NULL platform_role rows.`);
  }
}

async function checkInvalidPlatformRoles() {
  const validList = VALID_PLATFORM_ROLES.map((role) => `'${role}'`).join(', ');
  const { rows } = await query(`SELECT id, email, global_role, platform_role FROM users WHERE platform_role NOT IN (${validList})`);
  if (rows.length === 0) {
    pass('All platform_role values are valid');
    return;
  }
  fail(`${rows.length} users with invalid platform_role values`);
  for (const row of rows) {
    console.log(`   ${row.id} | ${row.email} | global_role=${row.global_role} | platform_role=${row.platform_role}`);
  }
}

async function checkEditorMapping() {
  const count = await countRows(`SELECT COUNT(*) FROM users WHERE platform_role = 'editor'`);
  if (count === 0) {
    pass(`No users have platform_role = 'editor' (correct)`);
  } else {
    fail(`${count} users still have platform_role = 'editor'`);
  }
}

async function checkGlobalRoleConsistency() {
  const { rows } = await query(`
    SELECT id, email, global_role, platform_role
    FROM users
    WHERE
      (global_role = 'admin' AND platform_role != 'admin') OR
      (global_role = 'reviewer' AND platform_role != 'reviewer') OR
      (global_role = 'designer' AND platform_role != 'designer') OR
      (global_role = 'ad_ops' AND platform_role != 'ad_ops')
  `);
  if (rows.length === 0) {
    pass('All direct global_role → platform_role mappings are consistent');
    return;
  }
  warn(`${rows.length} users have potentially inconsistent role mappings`);
}

async function checkProductAccess() {
  const nullMembers = await countRows('SELECT COUNT(*) FROM workspace_members WHERE product_access IS NULL');
  if (nullMembers === 0) {
    pass('No workspace_members with NULL product_access');
  } else {
    fail(`${nullMembers} workspace_members with NULL product_access`);
    if (!DRY_RUN) {
      await query(`UPDATE workspace_members SET product_access = '{"ad_server": true, "studio": true}'::jsonb WHERE product_access IS NULL`);
      pass(`Fixed ${nullMembers} workspace_members product_access → default.`);
    }
  }

  const nullInvites = await countRows('SELECT COUNT(*) FROM workspace_invites WHERE product_access IS NULL');
  if (nullInvites === 0) {
    pass('No workspace_invites with NULL product_access');
  } else {
    fail(`${nullInvites} workspace_invites with NULL product_access`);
    if (!DRY_RUN) {
      await query(`UPDATE workspace_invites SET product_access = '{"ad_server": true, "studio": true}'::jsonb WHERE product_access IS NULL`);
      pass(`Fixed ${nullInvites} workspace_invites product_access → default.`);
    }
  }
}

async function printPlatformRoleSummary() {
  const { rows } = await query(`
    SELECT platform_role, COUNT(*) as count
    FROM users
    GROUP BY platform_role
    ORDER BY count DESC
  `);
  console.log('\n── Platform role distribution ──────────────────────');
  for (const row of rows) {
    const bar = '█'.repeat(Math.min(40, Math.round(Number(row.count) / 2)));
    console.log(`  ${(row.platform_role || 'NULL').padEnd(10)} ${row.count.toString().padStart(5)}  ${bar}`);
  }
}

async function printProductAccessSummary() {
  const { rows } = await query(`
    SELECT
      CASE
        WHEN (product_access ->> 'ad_server')::boolean AND (product_access ->> 'studio')::boolean THEN 'both'
        WHEN (product_access ->> 'ad_server')::boolean THEN 'ad_server_only'
        WHEN (product_access ->> 'studio')::boolean THEN 'studio_only'
        ELSE 'none'
      END AS access_type,
      COUNT(*) as count
    FROM workspace_members
    GROUP BY access_type
    ORDER BY count DESC
  `);
  console.log('\n── Product access distribution (workspace_members) ──');
  for (const row of rows) {
    const bar = '█'.repeat(Math.min(40, Math.round(Number(row.count) / 3)));
    console.log(`  ${row.access_type.padEnd(16)} ${row.count.toString().padStart(5)}  ${bar}`);
  }
}

async function checkAuditImportRecord() {
  const count = await countRows(`SELECT COUNT(*) FROM audit_events WHERE action = 'legacy_import_completed'`);
  if (count > 0) {
    pass(`Legacy import audit record found (${count} import runs)`);
  } else {
    warn('No legacy import audit record found', 'Was db:import:legacy run on this database?');
  }
}

async function checkUserCount() {
  const total = await countRows('SELECT COUNT(*) FROM users');
  const withPlatformRole = await countRows('SELECT COUNT(*) FROM users WHERE platform_role IS NOT NULL');
  info(`Total users: ${total} | With platform_role: ${withPlatformRole}`);
}

async function main() {
  console.log(`\nS42 Legacy Migration Validation${!DRY_RUN ? ' [FIX MODE]' : ''}`);
  console.log(`Database: ${CONNECTION.replace(/:([^:@]+)@/, ':***@')}`);
  console.log('─'.repeat(60) + '\n');

  try {
    await checkAuditImportRecord();
    await checkUserCount();
    console.log('');
    await checkNullPlatformRoles();
    await checkInvalidPlatformRoles();
    await checkEditorMapping();
    await checkGlobalRoleConsistency();
    console.log('');
    await checkProductAccess();
    await printPlatformRoleSummary();
    await printProductAccessSummary();
  } catch (error) {
    console.error('\nDB error:', error.message);
    process.exit(2);
  } finally {
    await pool.end();
  }

  console.log('\n' + '─'.repeat(60));
  if (hasErrors) {
    console.log(err('Validation FAILED — see errors above.'));
    if (DRY_RUN) console.log('   Run with --fix to auto-correct safe issues.');
    process.exit(1);
  } else {
    console.log(ok('Validation PASSED — legacy migration looks correct.'));
    process.exit(0);
  }
}

main();
