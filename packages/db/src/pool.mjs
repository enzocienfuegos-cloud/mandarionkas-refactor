/**
 * pool.mjs — PostgreSQL connection pool factory.
 *
 * Usage:
 *   import { createPool } from '@smx/db/pool';
 *   const pool = createPool();          // uses DATABASE_URL env var
 *   const pool = createPool(connStr);   // explicit connection string
 */

import pg from 'pg';

const { Pool } = pg;

/**
 * Creates and returns a pg.Pool.
 * Reads DATABASE_URL from environment by default.
 *
 * @param {string} [connectionString]
 * @param {object} [opts]  — extra Pool options (poolSize, idleTimeoutMillis, …)
 */
export function createPool(connectionString, opts = {}) {
  const connStr = connectionString ?? process.env.DATABASE_URL;

  if (!connStr) {
    throw new Error(
      'DATABASE_URL is not set. Pass a connection string or set the environment variable.',
    );
  }

  const pool = new Pool({
    connectionString: connStr,
    max:                   parseInt(process.env.DB_POOL_MAX,  10) || 10,
    idleTimeoutMillis:     parseInt(process.env.DB_IDLE_MS,   10) || 30_000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_MS, 10) || 5_000,
    ssl: process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,
    ...opts,
  });

  pool.on('error', (err) => {
    console.error('[pg] Unexpected pool error:', err.message);
  });

  return pool;
}

/**
 * Global singleton pool — created on first import.
 * Use `createPool()` directly if you need multiple pools.
 */
let _pool;
export function getPool() {
  if (!_pool) _pool = createPool();
  return _pool;
}
