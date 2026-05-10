import { randomUUID } from 'node:crypto';
import { executePostgresQuery, getPostgresSchemaName, withPostgresTransaction } from './data/postgres-client.mjs';

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function table(name) {
  return `${quoteIdentifier(getPostgresSchemaName())}.${quoteIdentifier(name)}`;
}

export function createRequestContext(req) {
  return {
    requestId: randomUUID(),
    startedAtMs: Date.now(),
    method: req.method || 'GET',
    path: req.url || '/',
  };
}

export function logServerEvent(level, event, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

export async function recordRequestMetric(routeKey, statusCode, durationMs) {
  const errors4xxIncrement = statusCode >= 400 && statusCode < 500 ? 1 : 0;
  const errors5xxIncrement = statusCode >= 500 ? 1 : 0;

  await withPostgresTransaction(async (query) => {
    await query(
      `INSERT INTO ${table('observability_totals')} (
        id, started_at, requests, errors_4xx, errors_5xx, updated_at
      ) VALUES ('global', NOW(), 0, 0, 0, NOW())
      ON CONFLICT (id) DO NOTHING`
    );

    await query(
      `UPDATE ${table('observability_totals')}
       SET requests = requests + 1,
           errors_4xx = errors_4xx + $1,
           errors_5xx = errors_5xx + $2,
           updated_at = NOW()
       WHERE id = 'global'`,
      [errors4xxIncrement, errors5xxIncrement]
    );

    await query(
      `INSERT INTO ${table('observability_routes')} (
        route_key, requests, errors_4xx, errors_5xx, total_duration_ms, avg_duration_ms, last_status, last_request_at
      ) VALUES ($1, 1, $2, $3, $4, $4, $5, NOW())
      ON CONFLICT (route_key) DO UPDATE SET
        requests = ${table('observability_routes')}.requests + 1,
        errors_4xx = ${table('observability_routes')}.errors_4xx + EXCLUDED.errors_4xx,
        errors_5xx = ${table('observability_routes')}.errors_5xx + EXCLUDED.errors_5xx,
        total_duration_ms = ${table('observability_routes')}.total_duration_ms + EXCLUDED.total_duration_ms,
        avg_duration_ms = ROUND(((( ${table('observability_routes')}.total_duration_ms + EXCLUDED.total_duration_ms) / (${table('observability_routes')}.requests + 1))::numeric), 2),
        last_status = EXCLUDED.last_status,
        last_request_at = NOW()`,
      [routeKey, errors4xxIncrement, errors5xxIncrement, durationMs, statusCode]
    );
  });
}

export async function getObservabilitySnapshot() {
  await executePostgresQuery(
    `INSERT INTO ${table('observability_totals')} (
      id, started_at, requests, errors_4xx, errors_5xx, updated_at
    ) VALUES ('global', NOW(), 0, 0, 0, NOW())
    ON CONFLICT (id) DO NOTHING`
  );

  const [totalsResult, routesResult] = await Promise.all([
    executePostgresQuery(`SELECT * FROM ${table('observability_totals')} WHERE id = 'global' LIMIT 1`),
    executePostgresQuery(`SELECT * FROM ${table('observability_routes')} ORDER BY route_key ASC`),
  ]);

  const totalsRow = totalsResult.rows?.[0] ?? {};
  const routes = Object.fromEntries(
    (routesResult.rows ?? []).map((row) => [row.route_key, {
      requests: Number(row.requests || 0),
      errors4xx: Number(row.errors_4xx || 0),
      errors5xx: Number(row.errors_5xx || 0),
      avgDurationMs: Number(row.avg_duration_ms || 0),
      lastStatus: Number(row.last_status || 0),
      lastRequestAt: row.last_request_at ? new Date(row.last_request_at).toISOString() : '',
    }])
  );

  return {
    ok: true,
    startedAt: totalsRow.started_at ? new Date(totalsRow.started_at).toISOString() : '',
    totals: {
      requests: Number(totalsRow.requests || 0),
      errors4xx: Number(totalsRow.errors_4xx || 0),
      errors5xx: Number(totalsRow.errors_5xx || 0),
    },
    routes,
  };
}
