import { runMigrations } from '../src/migrations.mjs';
import { closeAllPools } from '../src/pool.mjs';

try {
  const result = await runMigrations({ connectionString: process.env.DATABASE_URL });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await closeAllPools();
}
