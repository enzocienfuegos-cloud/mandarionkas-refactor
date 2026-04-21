const WEB_URL = (process.env.STAGING_WEB_URL ?? 'https://app-staging.duskplatform.co').replace(/\/+$/, '');
const API_URL = (process.env.STAGING_API_URL ?? 'https://api-staging.duskplatform.co').replace(/\/+$/, '');
const STUDIO_URL = (process.env.STAGING_STUDIO_URL ?? 'https://studio-staging.duskplatform.co').replace(/\/+$/, '');
const SMOKE_EMAIL = process.env.STAGING_SMOKE_EMAIL ?? '';
const SMOKE_PASSWORD = process.env.STAGING_SMOKE_PASSWORD ?? '';

async function fetchText(url, options = {}) {
  const response = await fetch(url, { redirect: 'follow', ...options });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function withMigrationHint(message) {
  if (message.includes('studio_brands')
    || message.includes('studio_invites')
    || message.includes('studio_project_versions')) {
    return `${message}\nHint: staging API is running newer studio code than the database schema. Run \`npm run migrate\` on the deployed API component.`;
  }
  return message;
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

function readSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function createCookieJar() {
  const store = new Map();
  return {
    ingest(headers) {
      for (const cookie of readSetCookies(headers)) {
        const [pair] = cookie.split(';', 1);
        const [name, ...rest] = pair.split('=');
        if (!name || rest.length === 0) continue;
        store.set(name.trim(), rest.join('=').trim());
      }
    },
    header() {
      return Array.from(store.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
    },
  };
}

async function fetchJson(url, { method = 'GET', headers = {}, body, cookieJar } = {}) {
  const mergedHeaders = {
    Accept: 'application/json',
    ...headers,
  };
  if (body != null) {
    mergedHeaders['Content-Type'] = 'application/json';
  }
  const cookieHeader = cookieJar?.header();
  if (cookieHeader) mergedHeaders.Cookie = cookieHeader;

  const response = await fetch(url, {
    method,
    headers: mergedHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
    redirect: 'follow',
  });
  cookieJar?.ingest(response.headers);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: response.status,
    headers: response.headers,
    body: text,
    json,
  };
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

  if (SMOKE_EMAIL && SMOKE_PASSWORD) {
    const cookieJar = createCookieJar();
    const login = await fetchJson(`${API_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { Origin: WEB_URL },
      body: { email: SMOKE_EMAIL, password: SMOKE_PASSWORD },
      cookieJar,
    });
    assert(login.status === 200, `Expected login to return 200, got ${login.status}: ${login.body}`);

    const session = await fetchJson(`${API_URL}/v1/auth/session`, {
      headers: { Origin: STUDIO_URL },
      cookieJar,
    });
    assert(session.status === 200, `Expected auth/session to return 200, got ${session.status}`);
    assert(session.json?.authenticated === true, 'Expected auth/session to return authenticated=true after login.');
    assert(
      (session.headers.get('access-control-allow-origin') ?? '') === STUDIO_URL,
      `Expected auth/session CORS header to match ${STUDIO_URL}.`,
    );

    const projects = await fetchJson(`${API_URL}/v1/projects`, {
      headers: { Origin: STUDIO_URL },
      cookieJar,
    });
    assert(projects.status === 200, `Expected projects to return 200, got ${projects.status}: ${projects.body}`);
    assert(Array.isArray(projects.json?.projects), 'Expected projects endpoint to return an array.');

    const assets = await fetchJson(`${API_URL}/v1/assets`, {
      headers: { Origin: STUDIO_URL },
      cookieJar,
    });
    assert(assets.status === 200, `Expected assets to return 200, got ${assets.status}: ${assets.body}`);
    assert(Array.isArray(assets.json?.assets), 'Expected assets endpoint to return an array.');
  }

  console.log('Smoke checks passed.');
  console.log(`- web: ${WEB_URL}`);
  console.log(`- studio: ${STUDIO_URL}`);
  console.log(`- api: ${API_URL}`);
  if (SMOKE_EMAIL && SMOKE_PASSWORD) {
    console.log(`- authenticated smoke: ${SMOKE_EMAIL}`);
  }
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${withMigrationHint(error.message)}`);
  process.exit(1);
});
