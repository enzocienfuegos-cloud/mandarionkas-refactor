import { getServerEnv } from '../env.mjs';

const env = getServerEnv();
let poolPromise = null;

function getInjectedExecutor() {
  return typeof globalThis.__SMX_PLATFORM_PG_EXECUTE__ === 'function' ? globalThis.__SMX_PLATFORM_PG_EXECUTE__ : null;
}

function getInjectedTransactionRunner() {
  return typeof globalThis.__SMX_PLATFORM_PG_TRANSACTION__ === 'function' ? globalThis.__SMX_PLATFORM_PG_TRANSACTION__ : null;
}

function getSslConfig() {
  if (env.postgresSslMode !== 'require') return undefined;
  return { rejectUnauthorized: false };
}

function getSchemaName() {
  const schema = String(env.postgresSchema || 'public').trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid PostgreSQL schema name: ${schema}`);
  }
  return schema;
}

export function getPostgresSchemaName() {
  return getSchemaName();
}

function normalizePostgresError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown PostgreSQL error');
  const code = error && typeof error === 'object' ? error.code : '';
  if (code === '42P01' || /relation .* does not exist/i.test(message)) {
    return new Error(`PostgreSQL schema is missing or incomplete. Apply server/data/postgres-schema.sql to schema "${getSchemaName()}" before enabling the postgres repository driver.`);
  }
  return error instanceof Error ? error : new Error(message);
}

async function getPool() {
  if (poolPromise) return poolPromise;
  poolPromise = (async () => {
    try {
      const { Pool } = await import('pg');
      return new Pool({
        connectionString: env.postgresUrl,
        ssl: getSslConfig(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown import error';
      throw new Error(`PostgreSQL driver is not available. Install the \`pg\` package or inject __SMX_PLATFORM_PG_EXECUTE__. ${message}`);
    }
  })();
  return poolPromise;
}

export function getPostgresMetadata() {
  return {
    urlConfigured: Boolean(env.postgresUrl),
    schema: getSchemaName(),
    sslMode: env.postgresSslMode,
  };
}

export async function checkPostgresConnection() {
  const schema = getSchemaName();
  const result = await executePostgresQuery(
    'SELECT version() AS server_version, NOW() AS server_time'
  );
  const row = result.rows?.[0] ?? {};
  return {
    ok: true,
    schema,
    currentSchema: schema,
    serverVersion: row.server_version || '',
    serverTime: row.server_time || null,
  };
}

export async function executePostgresQuery(text, params = [], runner = null) {
  try {
    if (typeof runner === 'function') {
      return await runner(text, params);
    }
    const injected = getInjectedExecutor();
    if (injected) {
      return await injected(text, params);
    }
    if (!env.postgresUrl) {
      throw new Error('Missing PostgreSQL configuration. Set PLATFORM_POSTGRES_URL before enabling the postgres repository driver.');
    }
    const pool = await getPool();
    return await pool.query(text, params);
  } catch (error) {
    throw normalizePostgresError(error);
  }
}

export async function withPostgresTransaction(callback) {
  const injectedRunner = getInjectedTransactionRunner();
  if (injectedRunner) {
    try {
      return await injectedRunner((runner) => callback((text, params = []) => executePostgresQuery(text, params, runner)));
    } catch (error) {
      throw normalizePostgresError(error);
    }
  }

  if (!env.postgresUrl) {
    throw new Error('Missing PostgreSQL configuration. Set PLATFORM_POSTGRES_URL before enabling the postgres repository driver.');
  }

  const pool = await getPool();
  const client = await pool.connect();
  const query = (text, params = []) => client.query(text, params);
  try {
    await query('BEGIN');
    await query(`SET LOCAL search_path TO "${getSchemaName()}"`);
    const result = await callback(query);
    await query('COMMIT');
    return result;
  } catch (error) {
    await query('ROLLBACK');
    throw normalizePostgresError(error);
  } finally {
    client.release();
  }
}
