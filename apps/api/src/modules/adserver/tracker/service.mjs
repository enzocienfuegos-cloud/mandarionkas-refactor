import { logWarn } from '../../../lib/logger.mjs';

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
    tagId, workspaceId, remoteIp, userAgent, country, region, city,
    deviceId, deviceType, deviceModel, browser, os, networkId, sourcePublisherId,
    appId, siteId, exchangeId, exchangePublisherId, exchangeSiteIdOrDomain,
    appBundle, appName, pagePosition, contentLanguage, contentTitle, contentSeries,
    carrier, appStoreName, contentGenre, contextualIds, ipFingerprint,
    sfTz, sfLang, sfScr, sfTouch, sfMem, sfCpu, inferredContext,
    siteDomain, referer,
  } = payload;

  pool.query(
    `INSERT INTO impression_events
       (tag_id, workspace_id, ip, user_agent, country, region, city, site_domain, referer,
        device_id, device_type, device_model, browser, os, network_id, source_publisher_id,
        app_id, site_id, exchange_id, exchange_publisher_id, exchange_site_id_or_domain,
        app_bundle, app_name, page_position, content_language, content_title, content_series,
        carrier, app_store_name, content_genre, contextual_ids, ip_fingerprint,
        sf_timezone, sf_language, sf_screen, sf_touch, sf_mem_gb, sf_cpu_cores, inferred_context)
     VALUES ($1,$2,$3::inet,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
             $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39)`,
    [
      tagId, workspaceId, remoteIp || null, userAgent || null, country || null, region || null, city || null,
      siteDomain || null, referer || null, deviceId || null, deviceType || null, deviceModel || null,
      browser || null, os || null, networkId || null, sourcePublisherId || null, appId || null, siteId || null,
      exchangeId || null, exchangePublisherId || null, exchangeSiteIdOrDomain || null,
      appBundle || null, appName || null, pagePosition || null, contentLanguage || null,
      contentTitle || null, contentSeries || null, carrier || null, appStoreName || null,
      contentGenre || null, contextualIds || null, ipFingerprint || null,
      sfTz || null, sfLang || null, sfScr || null,
      sfTouch !== null && sfTouch !== undefined ? sfTouch : null,
      sfMem || null, sfCpu || null, inferredContext || null,
    ],
  ).catch((err) => logWarn({
    service: 'smx-tracker-service',
    fn: 'queueImpressionEventWrite',
    tagId,
    message: err?.message,
  }));
}
