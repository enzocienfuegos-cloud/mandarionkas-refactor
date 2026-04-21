const WEB_URL = (process.env.STAGING_WEB_URL ?? 'https://app-staging.duskplatform.co').replace(/\/+$/, '');
const API_URL = (process.env.STAGING_API_URL ?? 'https://api-staging.duskplatform.co').replace(/\/+$/, '');
const STUDIO_URL = (process.env.STAGING_STUDIO_URL ?? 'https://studio-staging.duskplatform.co').replace(/\/+$/, '');

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractAssetPath(html, kind) {
  const pattern = kind === 'script'
    ? /<script[^>]+src="([^"]+assets\/[^"]+\.js)"/i
    : /<link[^>]+href="([^"]+assets\/[^"]+\.css)"/i;
  return html.match(pattern)?.[1] ?? null;
}

async function checkAsset(baseUrl, assetPath, expectedTypes) {
  assert(assetPath, `Expected ${baseUrl} HTML to reference an asset path.`);
  assert(!assetPath.startsWith('/studio/assets/'), `Expected assets under /assets on ${baseUrl}, received ${assetPath}`);

  const assetUrl = new URL(assetPath, `${baseUrl}/`).toString();
  const asset = await fetchText(assetUrl);
  assert(asset.status === 200, `Expected ${assetUrl} to return 200, got ${asset.status}`);

  const contentType = asset.headers.get('content-type') ?? '';
  assert(
    expectedTypes.some((candidate) => contentType.includes(candidate)),
    `Expected ${assetUrl} content-type to include one of ${expectedTypes.join(', ')}, got ${contentType}`,
  );
}

async function main() {
  const web = await fetchText(`${WEB_URL}/`);
  assert(web.status === 200, `Expected ${WEB_URL}/ to return 200, got ${web.status}`);
  assert((web.headers.get('content-type') ?? '').includes('text/html'), `Expected ${WEB_URL}/ to serve HTML.`);

  const studio = await fetchText(`${STUDIO_URL}/`);
  assert(studio.status === 200, `Expected ${STUDIO_URL}/ to return 200, got ${studio.status}`);
  assert((studio.headers.get('content-type') ?? '').includes('text/html'), `Expected ${STUDIO_URL}/ to serve HTML.`);

  await checkAsset(STUDIO_URL, extractAssetPath(studio.body, 'script'), ['javascript', 'text/javascript']);
  await checkAsset(STUDIO_URL, extractAssetPath(studio.body, 'style'), ['text/css']);

  const health = await fetchText(`${API_URL}/health`);
  assert(health.status === 200, `Expected ${API_URL}/health to return 200, got ${health.status}`);

  const authMe = await fetchText(`${API_URL}/v1/auth/me`);
  assert([200, 401].includes(authMe.status), `Expected ${API_URL}/v1/auth/me to return 200 or 401, got ${authMe.status}`);

  console.log('Smoke checks passed.');
  console.log(`- web: ${WEB_URL}`);
  console.log(`- studio: ${STUDIO_URL}`);
  console.log(`- api: ${API_URL}`);
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exit(1);
});
