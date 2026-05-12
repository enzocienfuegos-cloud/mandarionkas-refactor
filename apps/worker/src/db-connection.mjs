function describeCandidate(key, value) {
  const connectionString = String(value || '').trim();
  if (!connectionString) {
    return {
      key,
      value: '',
      valid: false,
      parseError: 'empty',
      host: '',
      port: '',
      database: '',
      protocol: '',
    };
  }

  try {
    const parsed = new URL(connectionString);
    return {
      key,
      value: connectionString,
      valid: Boolean(parsed.hostname),
      parseError: parsed.hostname ? '' : 'missing_hostname',
      host: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname.replace(/^\//, ''),
      protocol: parsed.protocol.replace(/:$/, ''),
    };
  } catch (error) {
    return {
      key,
      value: connectionString,
      valid: false,
      parseError: error?.message || 'invalid_url',
      host: '',
      port: '',
      database: '',
      protocol: '',
    };
  }
}

export function resolveWorkerConnection(source = process.env) {
  const databaseUrl = describeCandidate('DATABASE_URL', source.DATABASE_URL);
  const databasePoolUrl = describeCandidate('DATABASE_POOL_URL', source.DATABASE_POOL_URL);
  const candidates = [databaseUrl, databasePoolUrl].filter((candidate) => candidate.value);

  const selected =
    (databaseUrl.valid && databaseUrl)
    || candidates.find((candidate) => candidate.valid)
    || candidates[0]
    || describeCandidate('DATABASE_URL', '');

  return {
    selected,
    databaseUrl,
    databasePoolUrl,
  };
}

export function getWorkerConnectionString(source = process.env) {
  return resolveWorkerConnection(source).selected.value;
}

export function describeWorkerConnection(source = process.env) {
  const { selected, databaseUrl, databasePoolUrl } = resolveWorkerConnection(source);

  return {
    selected: selected.key,
    selectedValid: selected.valid,
    selectedParseError: selected.parseError,
    hasDatabaseUrl: Boolean(databaseUrl.value),
    hasDatabasePoolUrl: Boolean(databasePoolUrl.value),
    databaseUrlValid: databaseUrl.valid,
    databasePoolUrlValid: databasePoolUrl.valid,
    host: selected.host,
    port: selected.port,
    database: selected.database,
    protocol: selected.protocol,
  };
}
