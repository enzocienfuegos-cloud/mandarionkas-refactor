export function getWorkerConnectionString(source = process.env) {
  return String(source.DATABASE_URL || source.DATABASE_POOL_URL || '').trim();
}

export function describeWorkerConnection(source = process.env) {
  const databaseUrl = String(source.DATABASE_URL || '').trim();
  const databasePoolUrl = String(source.DATABASE_POOL_URL || '').trim();
  const connectionString = getWorkerConnectionString(source);

  let host = '';
  let port = '';
  let database = '';

  try {
    const parsed = new URL(connectionString);
    host = parsed.hostname;
    port = parsed.port;
    database = parsed.pathname.replace(/^\//, '');
  } catch {
    // Best-effort logging for malformed URLs.
  }

  return {
    selected: connectionString === databaseUrl ? 'DATABASE_URL' : 'DATABASE_POOL_URL',
    hasDatabaseUrl: Boolean(databaseUrl),
    hasDatabasePoolUrl: Boolean(databasePoolUrl),
    host,
    port,
    database,
  };
}
