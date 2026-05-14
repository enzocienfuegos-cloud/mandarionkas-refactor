import { logWarn } from '../../../lib/logger.mjs';

const CONNECTION_COLUMNS_CHECK_TTL_MS = 60_000;
let connectionColumnsReady = false;
let connectionColumnsCheckedAt = 0;

async function hasConnectionColumns(pool) {
  if (connectionColumnsReady) return true;

  const now = Date.now();
  if (connectionColumnsCheckedAt && now - connectionColumnsCheckedAt < CONNECTION_COLUMNS_CHECK_TTL_MS) {
    return false;
  }
  connectionColumnsCheckedAt = now;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'impression_events'
         AND column_name IN (
           'connection_type',
           'effective_connection_type',
           'connection_downlink_mbps',
           'connection_rtt_ms',
           'connection_save_data'
         )`,
    );
    connectionColumnsReady = Number(rows[0]?.count ?? 0) === 5;
    return connectionColumnsReady;
  } catch (_) {
    return false;
  }
}

export async function resolveTagWorkspaceId(pool, tagId) {
  if (!pool || !tagId) return null;
  try {
    const { rows } = await pool.query(
      `SELECT workspace_id FROM ad_tags WHERE id = $1 LIMIT 1`,
      [tagId],
    );
    return rows[0]?.workspace_id ?? null;
  } catch (err) {
    logWarn({ service: 'smx-tracker-service', fn: 'resolveTagWorkspaceId', tagId, message: err?.message });
    return null;
  }
}

export function queueImpressionEventWrite(pool, payload) {
  if (!pool) return;
  const {
    tagId, workspaceId, creativeId, creativeSizeVariantId, remoteIp, userAgent, country, region, city,
    deviceId, deviceType, deviceModel, browser, os, networkId, sourcePublisherId,
    appId, siteId, exchangeId, exchangePublisherId, exchangeSiteIdOrDomain,
    appBundle, appName, pagePosition, contentLanguage, contentTitle, contentSeries,
    carrier, appStoreName, contentGenre, contextualIds, ipFingerprint,
    sfTz, sfLang, sfScr, sfTouch, sfMem, sfCpu,
    connectionType, effectiveConnectionType, connectionDownlink, connectionRtt, connectionSaveData,
    inferredContext,
    siteDomain, referer,
  } = payload;

  (async () => {
    const supportsConnectionColumns = await hasConnectionColumns(pool);
    const columns = [
      'tag_id', 'workspace_id', 'creative_id', 'creative_size_variant_id', 'ip', 'user_agent', 'country', 'region', 'city', 'site_domain', 'referer',
      'device_id', 'device_type', 'device_model', 'browser', 'os', 'network_id', 'source_publisher_id',
      'app_id', 'site_id', 'exchange_id', 'exchange_publisher_id', 'exchange_site_id_or_domain',
      'app_bundle', 'app_name', 'page_position', 'content_language', 'content_title', 'content_series',
      'carrier', 'app_store_name', 'content_genre', 'contextual_ids', 'ip_fingerprint',
      'sf_timezone', 'sf_language', 'sf_screen', 'sf_touch', 'sf_mem_gb', 'sf_cpu_cores',
    ];
    const values = [
      tagId, workspaceId, creativeId || null, creativeSizeVariantId || null, remoteIp || null, userAgent || null, country || null, region || null, city || null,
      siteDomain || null, referer || null, deviceId || null, deviceType || null, deviceModel || null,
      browser || null, os || null, networkId || null, sourcePublisherId || null, appId || null, siteId || null,
      exchangeId || null, exchangePublisherId || null, exchangeSiteIdOrDomain || null,
      appBundle || null, appName || null, pagePosition || null, contentLanguage || null,
      contentTitle || null, contentSeries || null, carrier || null, appStoreName || null,
      contentGenre || null, contextualIds || null, ipFingerprint || null,
      sfTz || null, sfLang || null, sfScr || null,
      sfTouch !== null && sfTouch !== undefined ? sfTouch : null,
      sfMem || null, sfCpu || null,
    ];

    if (supportsConnectionColumns) {
      columns.push('connection_type', 'effective_connection_type', 'connection_downlink_mbps', 'connection_rtt_ms', 'connection_save_data');
      values.push(
        connectionType || null,
        effectiveConnectionType || null,
        connectionDownlink || null,
        connectionRtt || null,
        connectionSaveData !== null && connectionSaveData !== undefined ? connectionSaveData : null,
      );
    }

    columns.push('inferred_context');
    values.push(inferredContext || null);

    const placeholders = values.map((_, index) => {
      const ordinal = index + 1;
      return columns[index] === 'ip' ? `$${ordinal}::inet` : `$${ordinal}`;
    });

    await pool.query(
      `INSERT INTO impression_events (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})`,
      values,
    );
  })().catch((err) => logWarn({
    service: 'smx-tracker-service',
    fn: 'queueImpressionEventWrite',
    tagId,
    message: err?.message,
  }));
}
