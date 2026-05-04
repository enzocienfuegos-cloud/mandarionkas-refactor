import pg from 'pg';
import { readFileSync } from 'node:fs';

const { Pool } = pg;
const pools = new Map();

function readCaCert() {
  const path = (process.env.POSTGRES_CA_CERT_PATH || '').trim();
  if (!path) return undefined;
  try {
    return readFileSync(path).toString();
  } catch (err) {
    if ((process.env.NODE_ENV || '') === 'production') throw err;
    return undefined;
  }
}

function buildSslConfig() {
  const caCert = readCaCert();
  const rejectUnauthorized = (process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED || 'true') !== 'false';
  if (caCert) {
    return { rejectUnauthorized: true, ca: caCert };
  }
  return { rejectUnauthorized };
}

export function createPool(connectionString, overrides = {}) {
  if (!connectionString) {
    throw new Error('A PostgreSQL connection string is required.');
  }

  const max = Number(process.env.PG_POOL_MAX) || overrides.max || 10;
  const idleTimeoutMs = Number(process.env.PG_POOL_IDLE_TIMEOUT_MS) || overrides.idleTimeoutMs || 10_000;
  const connectTimeoutMs = Number(process.env.PG_POOL_CONNECT_TIMEOUT_MS) || overrides.connectTimeoutMs || 5_000;

  return new Pool({
    connectionString,
    ssl: buildSslConfig(),
    max,
    idleTimeoutMillis: idleTimeoutMs,
    connectionTimeoutMillis: connectTimeoutMs,
  });
}

export function getPool(connectionString, overrides = {}) {
  if (!pools.has(connectionString)) {
    pools.set(connectionString, createPool(connectionString, overrides));
  }
  return pools.get(connectionString);
}

export async function closeAllPools() {
  const values = Array.from(pools.values());
  pools.clear();
  await Promise.all(values.map((pool) => pool.end()));
}
