import { runMigrations } from '../src/migrations.mjs';
import { closeAllPools } from '../src/pool.mjs';

function uniqueConnectionStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function isConnectionError(error) {
  const message = String(error?.message || '');
  return !message.startsWith('Migration failed for ');
}

try {
  const candidates = uniqueConnectionStrings([
    process.env.DATABASE_URL,
    process.env.DATABASE_POOL_URL,
  ]);

  if (!candidates.length) {
    throw new Error('DATABASE_URL or DATABASE_POOL_URL is required to run migrations.');
  }

  let lastError = null;
  let result = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const connectionString = candidates[index];
    try {
      result = await runMigrations({ connectionString });
      console.log(JSON.stringify({
        ok: true,
        connectionSource: index === 0 ? 'primary' : 'fallback',
        ...result,
      }, null, 2));
      break;
    } catch (error) {
      lastError = error;
      const shouldRetry = index < candidates.length - 1 && isConnectionError(error);
      if (!shouldRetry) throw error;
      console.warn(JSON.stringify({
        ok: false,
        retryingWithFallback: true,
        message: error.message,
      }, null, 2));
    }
  }

  if (!result && lastError) {
    throw lastError;
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await closeAllPools();
}
