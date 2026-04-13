import { sendJson } from '../../lib/http.mjs';
import { getPool } from '../../../../../packages/db/src/pool.mjs';

async function runReadinessChecks(env) {
  const checks = {
    configLoaded: true,
    databaseConfigured: Boolean(env.databaseUrl || env.databasePoolUrl),
    databaseReachable: false,
    databasePoolConfigured: Boolean(env.databasePoolUrl),
    sessionSecretConfigured: Boolean(env.sessionSecret),
    assetsBaseConfigured: Boolean(env.assetsPublicBaseUrl),
    r2SigningConfigured: Boolean(env.r2Endpoint && env.r2Bucket && env.r2AccessKeyId && env.r2SecretAccessKey),
  };

  if (!checks.databaseConfigured) {
    return { ok: false, checks, details: { database: 'missing_connection_string' } };
  }

  try {
    const pool = getPool(env.databasePoolUrl || env.databaseUrl);
    const result = await pool.query('select now() as db_time');
    checks.databaseReachable = Boolean(result.rows[0]?.db_time);
    return { ok: checks.databaseReachable && checks.sessionSecretConfigured, checks };
  } catch (error) {
    console.error('readyz database error:', error);

    return {
      ok: false,
      checks,
      details: { database: error.message },
    };
  }
}

export async function handleHealthRoutes({ method, pathname, res, requestId, env, warnings }) {
  if (method === 'GET' && pathname === '/') {
    sendJson(res, 200, {
      ok: true,
      service: env.appName,
      requestId,
      docs: {
        health: '/healthz',
        readiness: '/readyz',
        version: '/version',
        api: '/v1',
      },
    });
    return true;
  }

  if (method === 'GET' && pathname === '/healthz') {
    sendJson(res, 200, {
      ok: true,
      service: env.appName,
      requestId,
      environment: env.appEnv,
      time: new Date().toISOString(),
    });
    return true;
  }

  if (method === 'GET' && pathname === '/readyz') {
    const readiness = await runReadinessChecks(env);
    sendJson(res, readiness.ok ? 200 : 503, {
      ok: readiness.ok,
      service: env.appName,
      requestId,
      checks: readiness.checks,
      warnings,
      ...(readiness.details ? { details: readiness.details } : {}),
    });
    return true;
  }

  if (method === 'GET' && pathname === '/version') {
    sendJson(res, 200, {
      ok: true,
      service: env.appName,
      requestId,
      gitSha: env.gitSha,
      buildTime: env.buildTime,
      environment: env.appEnv,
      contractVersion: 'v1',
    });
    return true;
  }

  return false;
}
