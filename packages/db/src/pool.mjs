import pg from 'pg';

const { Pool } = pg;
const pools = new Map();

function resolveSsl(connectionString) {
  try {
    const url = new URL(connectionString);
    const sslmode = (url.searchParams.get('sslmode') || '').toLowerCase();
    if (!sslmode || sslmode === 'disable') return undefined;
    return { rejectUnauthorized: false };
  } catch {
    return undefined;
  }
}

export function createPool(connectionString) {
  if (!connectionString) {
    throw new Error('A PostgreSQL connection string is required.');
  }

  return new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    max: 10,
    idleTimeoutMillis: 10000,
  });
}

export function getPool(connectionString) {
  if (!pools.has(connectionString)) {
    pools.set(connectionString, createPool(connectionString));
  }
  return pools.get(connectionString);
}

export async function closeAllPools() {
  const values = Array.from(pools.values());
  pools.clear();
  await Promise.all(values.map((pool) => pool.end()));
}
