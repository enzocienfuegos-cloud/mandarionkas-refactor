import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { checkRepositoryReadiness, getRepositoryMetadata } from '../server/data/repository.mjs';

loadOptionalEnvFile();

async function main() {
  const metadata = getRepositoryMetadata();
  const readiness = await checkRepositoryReadiness();
  console.log(JSON.stringify({ metadata, readiness }, null, 2));
}

main().catch((error) => {
  const metadata = getRepositoryMetadata();
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ ok: false, metadata, message }, null, 2));
  process.exit(1);
});
