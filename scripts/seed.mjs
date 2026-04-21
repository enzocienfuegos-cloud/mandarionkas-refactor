#!/usr/bin/env node
/**
 * seed.mjs — Insert baseline data for local development.
 *
 * Creates:
 *   • 1 workspace (slug: demo)
 *   • 1 admin user  (email: admin@smxstudio.io  password: Admin1234!)
 *   • 1 advertiser  (Acme Corp)
 *   • 1 campaign    (Demo Campaign — 90-day flight, 1M impression goal)
 *   • 2 ad tags     (VAST + display)
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   node scripts/seed.mjs
 */

import 'dotenv/config';
import pg from 'pg';
import { hashPassword } from '@smx/db';

const { Client } = pg;

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
  });
  await client.connect();
  console.log('Connected. Seeding…\n');

  try {
    const adminPasswordHash = await hashPassword('Admin1234!');

    // ── Workspace ───────────────────────────────────────────────────────────
    const wsResult = await client.query(`
      INSERT INTO workspaces (id, name, slug, plan)
      VALUES (gen_random_uuid(), 'SMX Demo', 'demo', 'pro')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `);
    const workspace = wsResult.rows[0];
    console.log(`  ✓  Workspace:  ${workspace.name}  (${workspace.id})`);

    // ── Admin user ──────────────────────────────────────────────────────────
    const userResult = await client.query(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_url)
      VALUES (gen_random_uuid(), 'admin@smxstudio.io', $1, 'Admin User', NULL)
      ON CONFLICT (email) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash
      RETURNING id, email
    `, [adminPasswordHash]);
    const user = userResult.rows[0];
    console.log(`  ✓  Admin user: ${user.email}  (${user.id})`);

    // ── Workspace membership (owner) ────────────────────────────────────────
    await client.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role)
      VALUES ($1, $2, 'owner')
      ON CONFLICT (workspace_id, user_id) DO NOTHING
    `, [workspace.id, user.id]);
    console.log(`  ✓  Membership: owner`);

    // ── Advertiser ──────────────────────────────────────────────────────────
    const advResult = await client.query(`
      INSERT INTO advertisers (id, workspace_id, name, domain)
      VALUES (gen_random_uuid(), $1, 'Acme Corp', 'acme.com')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `, [workspace.id]);

    let advertiser = advResult.rows[0];
    if (!advertiser) {
      const r = await client.query(
        `SELECT id, name FROM advertisers WHERE workspace_id = $1 AND name = 'Acme Corp'`,
        [workspace.id],
      );
      advertiser = r.rows[0];
    }
    console.log(`  ✓  Advertiser: ${advertiser.name}  (${advertiser.id})`);

    // ── Campaign ─────────────────────────────────────────────────────────────
    const today     = new Date();
    const startDate = today.toISOString().slice(0, 10);
    const endDate   = new Date(today.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);

    const campResult = await client.query(`
      INSERT INTO campaigns (id, workspace_id, advertiser_id, name, status,
                             start_date, end_date, impression_goal)
      VALUES (gen_random_uuid(), $1, $2, 'Demo Campaign', 'active', $3, $4, 1000000)
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `, [workspace.id, advertiser.id, startDate, endDate]);

    let campaign = campResult.rows[0];
    if (!campaign) {
      const r = await client.query(
        `SELECT id, name FROM campaigns WHERE workspace_id = $1 AND name = 'Demo Campaign'`,
        [workspace.id],
      );
      campaign = r.rows[0];
    }
    console.log(`  ✓  Campaign:   ${campaign.name}  (${campaign.id})`);
    console.log(`              Flight: ${startDate} → ${endDate}, Goal: 1,000,000 imps`);

    // ── VAST tag ─────────────────────────────────────────────────────────────
    const vastTagResult = await client.query(`
      INSERT INTO ad_tags (id, workspace_id, campaign_id, name, format, status)
      VALUES (gen_random_uuid(), $1, $2, 'Demo VAST Tag', 'vast', 'active')
      ON CONFLICT DO NOTHING
      RETURNING id, name, format
    `, [workspace.id, campaign.id]);

    const vastTag = vastTagResult.rows[0];
    if (vastTag) {
      console.log(`  ✓  Tag (VAST):    ${vastTag.name}  (${vastTag.id})`);
    }

    // ── Display tag ──────────────────────────────────────────────────────────
    const dispTagResult = await client.query(`
      INSERT INTO ad_tags (id, workspace_id, campaign_id, name, format, status)
      VALUES (gen_random_uuid(), $1, $2, 'Demo Display Tag', 'display', 'active')
      ON CONFLICT DO NOTHING
      RETURNING id, name, format
    `, [workspace.id, campaign.id]);

    const dispTag = dispTagResult.rows[0];
    if (dispTag) {
      console.log(`  ✓  Tag (display): ${dispTag.name}  (${dispTag.id})`);
    }

    console.log('\n─────────────────────────────────────────────');
    console.log('  Seed complete. Login credentials:');
    console.log('    URL:      https://app-staging.duskplatform.co');
    console.log('    Email:    admin@smxstudio.io');
    console.log('    Password: Admin1234!');
    console.log('\n  ✓  Password stored with bcrypt hash.\n');

  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
