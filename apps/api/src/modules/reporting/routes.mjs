import {
  getWorkspaceOverview,
  getWorkspaceStats,
  getWorkspaceCampaignBreakdown,
  getWorkspaceTagBreakdown,
  getWorkspaceCreativeBreakdown,
  getWorkspaceVariantBreakdown,
  getCampaignStats,
  getTagStats,
} from '@smx/db/reporting';
import {
  getWorkspaceSiteBreakdown,
  getWorkspaceCountryBreakdown,
  getWorkspaceRegionBreakdown,
  getWorkspaceCityBreakdown,
  getWorkspaceTrackerBreakdown,
  getWorkspaceEngagementBreakdown,
  getWorkspaceIdentityBreakdown,
  getWorkspaceIdentityExport,
  getWorkspaceIdentityAudienceExport,
  getWorkspaceIdentityFrequencyBuckets,
  getWorkspaceIdentitySegmentPresets,
  getWorkspaceIdentityKeyBreakdown,
  getWorkspaceIdentityAttributionWindows,
  listSavedAudiences,
  createSavedAudience,
  deleteSavedAudience,
} from '@smx/db/tracking';

export function handleReportingRoutes(app, { requireWorkspace, pool }) {
  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildIdentityAudienceCsv(rows, format = 'full') {
    if (format === 'activation') {
      return [
        ['identity_profile_id', 'canonical_type', 'canonical_value', 'country', 'region', 'city', 'device_ids', 'cookie_ids', 'external_user_ids'],
        ...rows.map((row) => ([
          row.id,
          row.canonical_type,
          row.canonical_value,
          row.last_country,
          row.last_region,
          row.last_city,
          row.device_ids,
          row.cookie_ids,
          row.external_user_ids,
        ])),
      ];
    }

    if (format === 'click_ids') {
      return [
        ['identity_profile_id', 'canonical_type', 'canonical_value', 'gclids', 'fbclids', 'ttclids', 'msclkids', 'clicks', 'engagements'],
        ...rows.map((row) => ([
          row.id,
          row.canonical_type,
          row.canonical_value,
          row.gclids,
          row.fbclids,
          row.ttclids,
          row.msclkids,
          row.clicks,
          row.engagements,
        ])),
      ];
    }

    return [
      [
        'identity_profile_id',
        'canonical_type',
        'canonical_value',
        'first_seen_at',
        'last_seen_at',
        'last_country',
        'last_region',
        'last_city',
        'confidence',
        'impressions',
        'clicks',
        'engagements',
        'ctr',
        'key_types',
        'device_ids',
        'cookie_ids',
        'external_user_ids',
        'gclids',
        'fbclids',
        'ttclids',
        'msclkids',
      ],
      ...rows.map((row) => ([
        row.id,
        row.canonical_type,
        row.canonical_value,
        row.first_seen_at,
        row.last_seen_at,
        row.last_country,
        row.last_region,
        row.last_city,
        row.confidence,
        row.impressions,
        row.clicks,
        row.engagements,
        row.ctr,
        row.key_types,
        row.device_ids,
        row.cookie_ids,
        row.external_user_ids,
        row.gclids,
        row.fbclids,
        row.ttclids,
        row.msclkids,
      ])),
    ];
  }

  // GET /v1/reporting/workspace — workspace-level aggregate stats
  app.get('/v1/reporting/workspace', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo } = req.query;

    const [stats, timeline] = await Promise.all([
      getWorkspaceOverview(pool, workspaceId, { dateFrom, dateTo }),
      getWorkspaceStats(pool, workspaceId, { dateFrom, dateTo }),
    ]);
    return reply.send({ stats, timeline });
  });

  app.get('/v1/reporting/workspace/campaign-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCampaignBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/tag-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceTagBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/site-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceSiteBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/country-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCountryBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/region-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceRegionBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/city-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCityBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/tracker-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceTrackerBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/engagement-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceEngagementBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId, limit } = req.query;
    const breakdown = await getWorkspaceIdentityBreakdown(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-export', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId } = req.query;
    const rows = await getWorkspaceIdentityExport(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId });
    const csvRows = [
      [
        'identity_profile_id',
        'canonical_type',
        'canonical_value',
        'first_seen_at',
        'last_seen_at',
        'last_country',
        'last_region',
        'last_city',
        'confidence',
        'impressions',
        'clicks',
        'engagements',
        'ctr',
        'key_type_count',
        'key_count',
        'key_types',
        'sources',
        'device_ids',
        'cookie_ids',
        'external_user_ids',
        'gclids',
        'fbclids',
        'ttclids',
        'msclkids',
      ],
      ...rows.map((row) => ([
        row.id,
        row.canonical_type,
        row.canonical_value,
        row.first_seen_at,
        row.last_seen_at,
        row.last_country,
        row.last_region,
        row.last_city,
        row.confidence,
        row.impressions,
        row.clicks,
        row.engagements,
        row.ctr,
        row.key_type_count,
        row.key_count,
        row.key_types,
        row.sources,
        row.device_ids,
        row.cookie_ids,
        row.external_user_ids,
        row.gclids,
        row.fbclids,
        row.ttclids,
        row.msclkids,
      ])),
    ];
    const csv = csvRows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="identity-report.csv"`)
      .send(csv);
  });

  app.get('/v1/reporting/workspace/identity-audience-export', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, country, segmentPreset, campaignId, tagId, creativeId, variantId, minImpressions, minClicks, format = 'full' } = req.query;
    const rows = await getWorkspaceIdentityAudienceExport(pool, workspaceId, {
      dateFrom,
      dateTo,
      canonicalType,
      country,
      segmentPreset,
      campaignId,
      tagId,
      creativeId,
      variantId,
      minImpressions,
      minClicks,
    });
    const csvRows = buildIdentityAudienceCsv(rows, String(format));
    const csv = csvRows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="identity-audience-${String(format)}.csv"`)
      .send(csv);
  });

  app.get('/v1/reporting/workspace/saved-audiences', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const audiences = await listSavedAudiences(pool, workspaceId);
    return reply.send({ audiences });
  });

  app.post('/v1/reporting/workspace/saved-audiences', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const audience = await createSavedAudience(pool, workspaceId, req.body ?? {});
    return reply.status(201).send({ audience });
  });

  app.delete('/v1/reporting/workspace/saved-audiences/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const deleted = await deleteSavedAudience(pool, workspaceId, req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Not Found', message: 'Saved audience not found' });
    }
    return reply.status(204).send();
  });

  app.get('/v1/reporting/workspace/identity-segment-presets', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId } = req.query;
    const breakdown = await getWorkspaceIdentitySegmentPresets(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-frequency-buckets', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId } = req.query;
    const breakdown = await getWorkspaceIdentityFrequencyBuckets(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-key-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId, limit } = req.query;
    const breakdown = await getWorkspaceIdentityKeyBreakdown(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/identity-attribution-windows', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId } = req.query;
    const breakdown = await getWorkspaceIdentityAttributionWindows(pool, workspaceId, { dateFrom, dateTo, canonicalType, campaignId, tagId, creativeId, variantId });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/creative-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceCreativeBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  app.get('/v1/reporting/workspace/variant-breakdown', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { dateFrom, dateTo, limit } = req.query;
    const breakdown = await getWorkspaceVariantBreakdown(pool, workspaceId, { dateFrom, dateTo, limit });
    return reply.send({ breakdown });
  });

  // GET /v1/reporting/campaigns/:id — campaign-level stats
  app.get('/v1/reporting/campaigns/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { dateFrom, dateTo, limit } = req.query;

    const stats = await getCampaignStats(pool, workspaceId, id, { dateFrom, dateTo, limit });
    return reply.send({ stats });
  });

  // GET /v1/reporting/tags/:id — tag-level daily stats
  app.get('/v1/reporting/tags/:id', { preHandler: requireWorkspace }, async (req, reply) => {
    const { workspaceId } = req.authSession;
    const { id } = req.params;
    const { dateFrom, dateTo, limit } = req.query;

    const stats = await getTagStats(pool, workspaceId, id, { dateFrom, dateTo, limit });
    if (!stats) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tag not found' });
    }
    return reply.send({ stats });
  });
}
