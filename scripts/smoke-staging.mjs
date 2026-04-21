const WEB_URL = (process.env.STAGING_WEB_URL ?? 'https://app-staging.duskplatform.co').replace(/\/+$/, '');
const API_URL = (process.env.STAGING_API_URL ?? 'https://api-staging.duskplatform.co').replace(/\/+$/, '');
const STUDIO_URL = (process.env.STAGING_STUDIO_URL ?? 'https://studio-staging.duskplatform.co').replace(/\/+$/, '');
const SMOKE_EMAIL = process.env.STAGING_SMOKE_EMAIL ?? '';
const SMOKE_PASSWORD = process.env.STAGING_SMOKE_PASSWORD ?? '';
const SMOKE_WRITE = process.env.STAGING_SMOKE_WRITE === 'true';
const EXPECT_UPLOADS = process.env.STAGING_EXPECT_UPLOADS === 'true';

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

function buildSmokeProjectState(label) {
  return {
    document: {
      name: label,
      scenes: [],
      canvas: { presetId: 'display-300x250' },
      metadata: {
        platform: {
          accessScope: 'client',
          campaignName: 'Smoke Test Campaign',
        },
      },
    },
  };
}

function buildSmokeTagName(stamp, format) {
  return `Smoke ${format} Tag ${stamp}`;
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

    if (SMOKE_WRITE) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const projectName = `Smoke Project ${stamp}`;
      const folderName = `Smoke Folder ${stamp}`;
      const assetName = `Smoke Asset ${stamp}`;
      const createdTagIds = [];

      const savedProject = await fetchJson(`${API_URL}/v1/projects/save`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: { state: buildSmokeProjectState(projectName) },
        cookieJar,
      });
      assert(savedProject.status === 200, `Expected project save to return 200, got ${savedProject.status}: ${savedProject.body}`);
      const projectId = savedProject.json?.project?.id;
      assert(projectId, 'Expected project save response to include a project id.');

      const savedVersion = await fetchJson(`${API_URL}/v1/projects/${projectId}/versions`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: { state: buildSmokeProjectState(`${projectName} v1`), note: 'smoke version' },
        cookieJar,
      });
      assert(savedVersion.status === 200, `Expected project version save to return 200, got ${savedVersion.status}: ${savedVersion.body}`);

      const versionList = await fetchJson(`${API_URL}/v1/projects/${projectId}/versions`, {
        headers: { Origin: STUDIO_URL },
        cookieJar,
      });
      assert(versionList.status === 200, `Expected project versions to return 200, got ${versionList.status}: ${versionList.body}`);
      assert(Array.isArray(versionList.json?.versions) && versionList.json.versions.length > 0, 'Expected at least one project version after save.');

      const folderCreate = await fetchJson(`${API_URL}/v1/assets/folders`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: { name: folderName },
        cookieJar,
      });
      assert(folderCreate.status === 200, `Expected asset folder create to return 200, got ${folderCreate.status}: ${folderCreate.body}`);
      const folderId = folderCreate.json?.folder?.id;
      assert(folderId, 'Expected folder create response to include an id.');

      const assetCreate = await fetchJson(`${API_URL}/v1/assets`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: {
          asset: {
            name: assetName,
            kind: 'image',
            src: 'https://example.com/smoke.png',
            mimeType: 'image/png',
            sourceType: 'external',
            storageMode: 'remote',
            accessScope: 'client',
          },
        },
        cookieJar,
      });
      assert(assetCreate.status === 200, `Expected asset create to return 200, got ${assetCreate.status}: ${assetCreate.body}`);
      const assetId = assetCreate.json?.asset?.id;
      assert(assetId, 'Expected asset create response to include an id.');

      const assetMove = await fetchJson(`${API_URL}/v1/assets/${assetId}/move`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: { folderId },
        cookieJar,
      });
      assert(assetMove.status === 200, `Expected asset move to return 200, got ${assetMove.status}: ${assetMove.body}`);

      const uploadPrep = await fetchJson(`${API_URL}/v1/assets/upload-url`, {
        method: 'POST',
        headers: { Origin: STUDIO_URL },
        body: {
          filename: 'smoke-upload.png',
          requestedName: 'Smoke Upload',
          mimeType: 'image/png',
          kind: 'image',
          sizeBytes: 1024,
          accessScope: 'client',
        },
        cookieJar,
      });
      if (EXPECT_UPLOADS) {
        assert(uploadPrep.status === 200, `Expected upload-url to return 200 when uploads are required, got ${uploadPrep.status}: ${uploadPrep.body}`);
        assert(uploadPrep.json?.upload?.uploadUrl, 'Expected upload-url response to include a signed uploadUrl.');
        assert(uploadPrep.json?.upload?.publicUrl, 'Expected upload-url response to include a publicUrl.');
      } else {
        assert(
          uploadPrep.status === 200 || uploadPrep.status === 503,
          `Expected upload-url to return 200 or 503, got ${uploadPrep.status}: ${uploadPrep.body}`,
        );
      }

      const createTag = async (format) => {
        const response = await fetchJson(`${API_URL}/v1/tags`, {
          method: 'POST',
          headers: { Origin: WEB_URL },
          body: {
            name: buildSmokeTagName(stamp, format),
            campaignId: null,
            format,
            status: 'active',
          },
          cookieJar,
        });
        assert(response.status === 201, `Expected tag create (${format}) to return 201, got ${response.status}: ${response.body}`);
        const tagId = response.json?.tag?.id;
        assert(tagId, `Expected tag create (${format}) to include an id.`);
        createdTagIds.push(tagId);
        return tagId;
      };

      const vastTagId = await createTag('VAST');
      const displayTagId = await createTag('display');

      const vastServe = await fetchText(`${API_URL}/v1/vast/tags/${vastTagId}`, {
        headers: { Cookie: cookieJar.header() },
      });
      assert(vastServe.status === 200, `Expected VAST serve to return 200, got ${vastServe.status}: ${vastServe.body}`);
      assert((vastServe.headers.get('content-type') ?? '').includes('application/xml'), 'Expected VAST serve content-type to be application/xml.');
      assert(vastServe.body.includes(`/track/impression/${vastTagId}`), 'Expected VAST XML to include impression tracking.');

      const displayServe = await fetchText(`${API_URL}/v1/vast/display/${displayTagId}`, {
        headers: { Cookie: cookieJar.header() },
      });
      assert(displayServe.status === 200, `Expected display serve to return 200, got ${displayServe.status}: ${displayServe.body}`);
      assert((displayServe.headers.get('content-type') ?? '').includes('application/javascript'), 'Expected display serve content-type to be JavaScript.');
      assert(displayServe.body.includes(`/track/impression/${displayTagId}`), 'Expected display snippet to include impression tracking.');

      const assetDelete = await fetchJson(`${API_URL}/v1/assets/${assetId}`, {
        method: 'DELETE',
        headers: { Origin: STUDIO_URL },
        cookieJar,
      });
      assert(assetDelete.status === 204, `Expected asset delete to return 204, got ${assetDelete.status}: ${assetDelete.body}`);

      const folderDelete = await fetchJson(`${API_URL}/v1/assets/folders/${folderId}`, {
        method: 'DELETE',
        headers: { Origin: STUDIO_URL },
        cookieJar,
      });
      assert(folderDelete.status === 204, `Expected asset folder delete to return 204, got ${folderDelete.status}: ${folderDelete.body}`);

      const projectDelete = await fetchJson(`${API_URL}/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Origin: STUDIO_URL },
        cookieJar,
      });
      assert(projectDelete.status === 204, `Expected project delete to return 204, got ${projectDelete.status}: ${projectDelete.body}`);

      for (const tagId of createdTagIds) {
        const tagDelete = await fetchJson(`${API_URL}/v1/tags/${tagId}`, {
          method: 'DELETE',
          headers: { Origin: WEB_URL },
          cookieJar,
        });
        assert(tagDelete.status === 204, `Expected tag delete to return 204, got ${tagDelete.status}: ${tagDelete.body}`);
      }
    }
  }

  console.log('Smoke checks passed.');
  console.log(`- web: ${WEB_URL}`);
  console.log(`- studio: ${STUDIO_URL}`);
  console.log(`- api: ${API_URL}`);
  if (SMOKE_EMAIL && SMOKE_PASSWORD) {
    console.log(`- authenticated smoke: ${SMOKE_EMAIL}`);
  }
  if (SMOKE_WRITE) {
    console.log('- write smoke: enabled');
  }
  if (EXPECT_UPLOADS) {
    console.log('- upload smoke: required');
  }
}

main().catch((error) => {
  console.error(`Smoke checks failed: ${withMigrationHint(error.message)}`);
  process.exit(1);
});
