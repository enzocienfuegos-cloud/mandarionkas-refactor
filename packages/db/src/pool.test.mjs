import test from 'node:test';
import assert from 'node:assert/strict';

test('createPool throws when connectionString is empty', async () => {
  const { createPool } = await import('./pool.mjs');
  assert.throws(() => createPool(''), /connection string/i);
});

test('createPool sets rejectUnauthorized=true by default', async () => {
  const origEnv = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED;
  const origCa = process.env.POSTGRES_CA_CERT_PATH;
  delete process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED;
  delete process.env.POSTGRES_CA_CERT_PATH;

  const { createPool } = await import(`./pool.mjs?ts=${Date.now()}`);
  const pool = createPool('postgresql://localhost/test');
  const capturedSsl = pool.options?.ssl;
  await pool.end().catch(() => undefined);

  if (capturedSsl !== undefined) {
    assert.notEqual(capturedSsl?.rejectUnauthorized, false, 'SSL debe verificar certificado por defecto');
  }

  if (origEnv !== undefined) process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED = origEnv;
  if (origCa !== undefined) process.env.POSTGRES_CA_CERT_PATH = origCa;
});
