const HTML5_PUBLISH_STALL_THRESHOLD_SECONDS = 2 * 60;
const HTML5_PUBLISH_MAX_RETRIES = 3;

export async function reconcileStalledHtml5Publishes(client, {
  stallThresholdSeconds = HTML5_PUBLISH_STALL_THRESHOLD_SECONDS,
  maxRetries = HTML5_PUBLISH_MAX_RETRIES,
} = {}) {
  const { rows: stalled } = await client.query(
    `SELECT id,
            workspace_id,
            creative_version_id,
            COALESCE((metadata->'publishJob'->>'retryCount')::int, 0) AS retry_count
       FROM creative_ingestions
      WHERE status = 'processing'
        AND source_kind = 'html5_zip'
        AND creative_version_id IS NOT NULL
        AND updated_at < NOW() - ($1::text || ' seconds')::interval
      ORDER BY updated_at ASC`,
    [String(stallThresholdSeconds)],
  );

  let requeued = 0;
  let exhausted = 0;

  for (const row of stalled) {
    const retryCount = Number(row.retry_count || 0);

    if (retryCount >= maxRetries) {
      await client.query(
        `UPDATE creative_ingestions
            SET status = 'failed',
                error_code = 'publish_stalled',
                error_detail = 'HTML5 publish job stalled past retry budget.',
                metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{publishJob,status}',
                  to_jsonb('failed'::text),
                  true
                ),
                updated_at = NOW()
          WHERE id = $1`,
        [row.id],
      );
      exhausted += 1;
      continue;
    }

    await client.query(
      `UPDATE creative_ingestions
          SET metadata = jsonb_set(
                jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{publishJob,retryCount}',
                  to_jsonb($2::int),
                  true
                ),
                '{publishJob,status}',
                to_jsonb('queued'::text),
                true
              ),
              updated_at = NOW()
        WHERE id = $1`,
      [row.id, retryCount + 1],
    );
    await client.query(`SELECT pg_notify('smx.publish-html5-archive', $1)`, [row.id]);
    requeued += 1;
  }

  return { stalled: stalled.length, requeued, exhausted };
}
