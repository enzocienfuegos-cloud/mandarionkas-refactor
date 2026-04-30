import { randomUUID } from 'node:crypto';
import { getPool, closeAllPools } from '../src/pool.mjs';
import { hashPassword } from '../../config/src/security.mjs';

const connectionString = process.env.DATABASE_URL;

function createSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

async function upsertUser(client, user) {
  const result = await client.query(
    `
      insert into users (id, email, password_hash, display_name, global_role)
      values ($1, $2, $3, $4, $5)
      on conflict (email) do update
      set password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          global_role = excluded.global_role,
          updated_at = now()
      returning id
    `,
    [user.id, user.email, user.passwordHash, user.displayName, user.globalRole],
  );
  return result.rows[0]?.id;
}

async function ensureAdvertiser(client, workspaceId) {
  const existing = await client.query(
    `
      select id
      from advertisers
      where workspace_id = $1
        and lower(name) = lower($2)
      limit 1
    `,
    [workspaceId, 'Bocadeli'],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const created = await client.query(
    `
      insert into advertisers (id, workspace_id, name, domain, industry, contact_email, notes, status)
      values ($1, $2, $3, $4, $5, $6, $7, 'active')
      returning id
    `,
    [
      randomUUID(),
      workspaceId,
      'Bocadeli',
      'bocadeli.com',
      'CPG',
      'media@bocadeli.com',
      'Seeded advertiser for ad server acceptance.',
    ],
  );
  return created.rows[0]?.id;
}

async function ensureCampaign(client, workspaceId, advertiserId) {
  const existing = await client.query(
    `
      select id
      from campaigns
      where workspace_id = $1
        and lower(name) = lower($2)
      limit 1
    `,
    [workspaceId, 'Bocadeli Launch'],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const created = await client.query(
    `
      insert into campaigns (
        id,
        workspace_id,
        advertiser_id,
        name,
        status,
        start_date,
        end_date,
        budget,
        impression_goal,
        daily_budget,
        flight_type,
        kpi,
        kpi_goal,
        currency,
        timezone,
        notes,
        metadata
      )
      values (
        $1,$2,$3,$4,'active',$5,$6,$7,$8,$9,'standard','ctr',$10,'USD','UTC',$11,$12::jsonb
      )
      returning id
    `,
    [
      randomUUID(),
      workspaceId,
      advertiserId,
      'Bocadeli Launch',
      '2026-04-01',
      '2026-06-30',
      15000,
      1200000,
      500,
      1.25,
      'Seeded campaign for ad server acceptance.',
      JSON.stringify({ dsp: 'Basis', mediaType: 'display' }),
    ],
  );
  return created.rows[0]?.id;
}

async function ensureTagAndStats(client, workspaceId, campaignId) {
  const tagResult = await client.query(
    `
      insert into ad_tags (id, workspace_id, campaign_id, name, format, status, click_url, impression_url, description)
      values ($1, $2, $3, $4, 'display', 'active', $5, $6, $7)
      on conflict do nothing
      returning id
    `,
    [
      randomUUID(),
      workspaceId,
      campaignId,
      'Bocadeli Hero 300x250',
      'https://bocadeli.com',
      'https://bocadeli.com/pixel',
      'Seeded display tag for analytics and campaign rollups.',
    ],
  );

  const resolvedTagId = tagResult.rows[0]?.id
    || (await client.query(
      `
        select id
        from ad_tags
        where workspace_id = $1
          and campaign_id = $2
          and lower(name) = lower($3)
        limit 1
      `,
      [workspaceId, campaignId, 'Bocadeli Hero 300x250'],
    )).rows[0]?.id;

  if (!resolvedTagId) return;

  await client.query(
    `
      insert into tag_format_configs (id, tag_id, display_width, display_height)
      values ($1, $2, 300, 250)
      on conflict (tag_id) do update
      set display_width = excluded.display_width,
          display_height = excluded.display_height,
          updated_at = now()
    `,
    [randomUUID(), resolvedTagId],
  );

  const today = new Date();
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - index);
    const date = day.toISOString().slice(0, 10);
    const impressions = 10000 - index * 500;
    const clicks = 120 - index * 8;
    const measured = Math.round(impressions * 0.92);
    const viewable = Math.round(measured * 0.71);
    const undetermined = impressions - measured;
    await client.query(
      `
        insert into tag_daily_stats (
          id, tag_id, date, impressions, clicks, viewable_imps, measured_imps, undetermined_imps, spend
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (tag_id, date) do update
        set impressions = excluded.impressions,
            clicks = excluded.clicks,
            viewable_imps = excluded.viewable_imps,
            measured_imps = excluded.measured_imps,
            undetermined_imps = excluded.undetermined_imps,
            spend = excluded.spend,
            updated_at = now()
      `,
      [randomUUID(), resolvedTagId, date, impressions, clicks, viewable, measured, undetermined, 42.5 + index],
    );

    await client.query(
      `
        insert into tag_engagement_daily_stats (id, tag_id, date, event_type, event_count, total_duration_ms)
        values ($1, $2, $3, 'hover_end', $4, $5)
        on conflict (tag_id, date, event_type) do update
        set event_count = excluded.event_count,
            total_duration_ms = excluded.total_duration_ms,
            updated_at = now()
      `,
      [randomUUID(), resolvedTagId, date, Math.max(25, 80 - index * 4), Math.max(20000, 90000 - index * 3000)],
    );
  }
}

async function ensureCreativeCatalog(client, workspaceId) {
  const existing = await client.query(
    `
      select id
      from creatives
      where workspace_id = $1
        and lower(name) = lower($2)
      limit 1
    `,
    [workspaceId, 'Bocadeli Spring HTML5'],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const creativeId = randomUUID();
  await client.query(
    `
      insert into creatives (
        id, workspace_id, name, type, file_url, thumbnail_url, file_size, mime_type,
        width, height, click_url, metadata, approval_status, transcode_status
      )
      values (
        $1, $2, $3, 'display', $4, $5, $6, 'application/zip',
        300, 250, $7, $8::jsonb, 'approved', 'ready'
      )
    `,
    [
      creativeId,
      workspaceId,
      'Bocadeli Spring HTML5',
      'https://cdn.duskplatform.co/demo/creatives/bocadeli-spring/index.html',
      'https://cdn.duskplatform.co/demo/creatives/bocadeli-spring/thumbnail.png',
      284312,
      'https://bocadeli.com/spring',
      JSON.stringify({ theme: 'spring-launch', template: 'bocadeli-worldcup' }),
    ],
  );

  const creativeVersionId = randomUUID();
  await client.query(
    `
      insert into creative_versions (
        id, workspace_id, creative_id, version_number, source_kind, serving_format, status,
        public_url, entry_path, mime_type, width, height, file_size, metadata
      )
      values (
        $1, $2, $3, 1, 'html5_zip', 'display_html', 'approved',
        $4, 'index.html', 'application/zip', 300, 250, $5, $6::jsonb
      )
    `,
    [
      creativeVersionId,
      workspaceId,
      creativeId,
      'https://cdn.duskplatform.co/demo/creatives/bocadeli-spring/index.html',
      284312,
      JSON.stringify({ build: 'seed-demo', previewAspectRatio: '6:5' }),
    ],
  );

  await client.query(
    `
      insert into creative_artifacts (
        id, workspace_id, creative_version_id, kind, storage_key, public_url, mime_type, size_bytes, metadata
      )
      values (
        $1, $2, $3, 'published_html', $4, $5, 'application/zip', $6, $7::jsonb
      )
    `,
    [
      randomUUID(),
      workspaceId,
      creativeVersionId,
      'demo/creatives/bocadeli-spring/source.zip',
      'https://cdn.duskplatform.co/demo/creatives/bocadeli-spring/source.zip',
      284312,
      JSON.stringify({ entryPath: 'index.html' }),
    ],
  );

  await client.query(
    `
      insert into creative_ingestions (
        id, workspace_id, creative_id, creative_version_id, source_kind, status,
        original_filename, mime_type, size_bytes, storage_key, public_url, metadata, validation_report
      )
      values (
        $1, $2, $3, $4, 'html5_zip', 'published',
        'bocadeli-spring-html5.zip', 'application/zip', $5, $6, $7, $8::jsonb, $9::jsonb
      )
    `,
    [
      randomUUID(),
      workspaceId,
      creativeId,
      creativeVersionId,
      284312,
      'demo/creative-ingestions/bocadeli-spring-html5.zip',
      'https://cdn.duskplatform.co/demo/creative-ingestions/bocadeli-spring-html5.zip',
      JSON.stringify({
        requestedName: 'Bocadeli Spring HTML5',
        publishJob: { stage: 'completed', status: 'completed' },
      }),
      JSON.stringify({ htmlValidated: true, manifestWarnings: [] }),
    ],
  );

  return creativeId;
}

async function main() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed demo data.');
  }

  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    const adminId = randomUUID();
    const editorId = randomUUID();
    const reviewerId = randomUUID();
    const adminHash = await hashPassword('demo123');
    const editorHash = await hashPassword('demo123');
    const reviewerHash = await hashPassword('demo123');

    await client.query('begin');

    const resolvedAdminId = await upsertUser(client, {
      id: adminId,
      email: 'admin@smx.studio',
      passwordHash: adminHash,
      displayName: 'SMX Admin',
      globalRole: 'admin',
    });
    const resolvedEditorId = await upsertUser(client, {
      id: editorId,
      email: 'editor@smx.studio',
      passwordHash: editorHash,
      displayName: 'Client Editor',
      globalRole: 'editor',
    });
    const resolvedReviewerId = await upsertUser(client, {
      id: reviewerId,
      email: 'reviewer@smx.studio',
      passwordHash: reviewerHash,
      displayName: 'Client Reviewer',
      globalRole: 'reviewer',
    });

    const workspaceId = randomUUID();
    const slug = createSlug('Default Client');
    await client.query(
      `
        insert into workspaces (id, slug, name, brand_color, owner_user_id)
        values ($1, $2, $3, $4, $5)
        on conflict (slug) do update set owner_user_id = excluded.owner_user_id
      `,
      [workspaceId, slug, 'Default Client', '#8b5cf6', resolvedAdminId],
    );

    const workspaceRow = await client.query('select id from workspaces where slug = $1 limit 1', [slug]);
    const resolvedWorkspaceId = workspaceRow.rows[0]?.id;
    if (!resolvedWorkspaceId) {
      throw new Error('Failed to resolve seeded workspace.');
    }

    for (const [userId, role] of [[resolvedAdminId, 'owner'], [resolvedEditorId, 'editor'], [resolvedReviewerId, 'reviewer']]) {
      await client.query(
        `
          insert into workspace_members (workspace_id, user_id, role)
          values ($1, $2, $3)
          on conflict (workspace_id, user_id) do update set role = excluded.role
        `,
        [resolvedWorkspaceId, userId, role],
      );
    }

    await client.query(
      `
        insert into brands (id, workspace_id, name, primary_color, secondary_color, accent_color, font_family)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict do nothing
      `,
      [randomUUID(), resolvedWorkspaceId, 'Core Brand', '#8b5cf6', '#0f172a', '#ec4899', 'Inter, system-ui, sans-serif'],
    );

    const advertiserId = await ensureAdvertiser(client, resolvedWorkspaceId);
    const campaignId = await ensureCampaign(client, resolvedWorkspaceId, advertiserId);
    await ensureTagAndStats(client, resolvedWorkspaceId, campaignId);
    await ensureCreativeCatalog(client, resolvedWorkspaceId);

    await client.query('commit');
    console.log(JSON.stringify({ ok: true, workspaceId: resolvedWorkspaceId }, null, 2));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await closeAllPools();
}
