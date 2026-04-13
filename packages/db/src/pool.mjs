import pg from 'pg';

const { Pool } = pg;
const pools = new Map();

export function createPool(connectionString) {
  if (!connectionString) {
    throw new Error('A PostgreSQL connection string is required.');
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
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
