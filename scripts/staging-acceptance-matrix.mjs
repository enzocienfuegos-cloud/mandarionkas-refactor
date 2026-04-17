import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const baseUrl = String(process.env.SMOKE_BASE_URL || process.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const email = String(process.env.SMOKE_LOGIN_EMAIL || '').trim();
const password = String(process.env.SMOKE_LOGIN_PASSWORD || '').trim();
const expectedDriver = String(
  process.env.STAGING_EXPECTED_REPOSITORY_DRIVER
  || process.env.SMOKE_EXPECTED_REPOSITORY_DRIVER
  || 'postgres'
).trim();
const includeUploadCompletion = String(process.env.STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION || 'false').trim() === 'true';
const requestedDomains = String(process.env.STAGING_ACCEPTANCE_DOMAINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!baseUrl) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_BASE_URL or VITE_API_BASE_URL for staging acceptance matrix.',
  }, null, 2));
  process.exit(1);
}

if (!email || !password) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Missing SMOKE_LOGIN_EMAIL or SMOKE_LOGIN_PASSWORD for staging acceptance matrix.',
  }, null, 2));
  process.exit(1);
}

const cookieJar = new Map();

function isoNowSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function updateCookies(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  const firstPair = setCookie.split(';')[0];
  const separatorIndex = firstPair.indexOf('=');
  if (separatorIndex <= 0) return;
  const name = firstPair.slice(0, separatorIndex).trim();
  const value = firstPair.slice(separatorIndex + 1).trim();
  if (!name) return;
  cookieJar.set(name, value);
}

function getCookieHeader() {
  return Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  const cookieHeader = getCookieHeader();
  if (cookieHeader) headers.set('Cookie', cookieHeader);

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  updateCookies(response);

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function uploadBinaryToSignedUrl(uploadUrl, mimeType, content) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
    },
    body: new TextEncoder().encode(content),
  });

  return {
    ok: response.ok,
    status: response.status,
  };
}

function createDomainRunner(selectedDomains) {
  return async function runDomain(domain, description, execute) {
    if (selectedDomains.length && !selectedDomains.includes(domain)) {
      return {
        domain,
        description,
        skipped: true,
        ok: true,
        checks: [],
      };
    }

    const checks = [];
    try {
      await execute({
        async check(step, operation) {
          const result = await operation();
          checks.push({ step, ...result });
          if (!result.ok) {
            throw new Error(result.message || `Check failed: ${step}`);
          }
          return result;
        },
      });
      return {
        domain,
        description,
        ok: true,
        checks,
      };
    } catch (error) {
      return {
        domain,
        description,
        ok: false,
        checks,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

function expect(ok, message, extra = {}) {
  return { ok: Boolean(ok), message, ...extra };
}

async function main() {
  const runDomain = createDomainRunner(requestedDomains);
  const context = {
    session: null,
    activeClientId: '',
  };

  const domains = [];

  domains.push(await runDomain('platform', 'Health, readiness, version and observability', async ({ check }) => {
    await check('health', async () => {
      const result = await request('/health');
      return expect(result.ok, 'Health check failed', {
        status: result.status,
        service: result.body?.service || '',
      });
    });

    await check('readyz', async () => {
      const result = await request('/readyz');
      const driver = result.body?.repository?.driver || '';
      return expect(
        result.ok && (!expectedDriver || driver === expectedDriver),
        `Readiness driver mismatch: expected ${expectedDriver}, got ${driver || 'unknown'}`,
        { status: result.status, driver },
      );
    });

    await check('version', async () => {
      const result = await request('/version');
      const driver = result.body?.repository?.driver || '';
      return expect(
        result.ok && (!expectedDriver || driver === expectedDriver),
        `Version driver mismatch: expected ${expectedDriver}, got ${driver || 'unknown'}`,
        { status: result.status, driver, version: result.body?.version || '' },
      );
    });

    await check('observability', async () => {
      const result = await request('/observability');
      const driver = result.body?.repository?.driver || '';
      return expect(
        result.ok && (!expectedDriver || driver === expectedDriver),
        `Observability driver mismatch: expected ${expectedDriver}, got ${driver || 'unknown'}`,
        {
          status: result.status,
          driver,
          totalRequests: result.body?.totals?.requests ?? null,
          total5xx: result.body?.totals?.status5xx ?? null,
        },
      );
    });
  }));

  domains.push(await runDomain('auth_session', 'Login, session restore and logout', async ({ check }) => {
    await check('login', async () => {
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember: false }),
      });
      if (result.ok) {
        context.session = result.body?.session || null;
      }
      return expect(result.ok && Boolean(result.body?.session?.sessionId), 'Login failed', {
        status: result.status,
        sessionId: result.body?.session?.sessionId || '',
      });
    });

    await check('auth-session', async () => {
      const result = await request('/auth/session');
      if (result.ok) {
        context.activeClientId = result.body?.activeClientId || '';
      }
      return expect(result.ok && Boolean(result.body?.activeClientId), 'Session restore failed', {
        status: result.status,
        activeClientId: result.body?.activeClientId || '',
      });
    });
  }));

  domains.push(await runDomain('clients_workspaces', 'Client visibility and active client selection', async ({ check }) => {
    await check('clients-list', async () => {
      const result = await request('/clients');
      const firstClientId = result.body?.clients?.[0]?.id || '';
      if (!context.activeClientId) context.activeClientId = result.body?.activeClientId || firstClientId;
      return expect(result.ok && Array.isArray(result.body?.clients) && result.body.clients.length > 0, 'Client list failed', {
        status: result.status,
        count: result.body?.clients?.length ?? 0,
      });
    });

    await check('clients-active', async () => {
      const result = await request('/clients/active', {
        method: 'POST',
        body: JSON.stringify({ clientId: context.activeClientId }),
      });
      return expect(result.ok && result.body?.activeClientId === context.activeClientId, 'Active client selection failed', {
        status: result.status,
        activeClientId: result.body?.activeClientId || '',
      });
    });
  }));

  domains.push(await runDomain('projects_versions', 'Project CRUD and version lifecycle', async ({ check }) => {
    let projectId = '';
    let versionId = '';
    const projectState = {
      document: {
        id: `proj_acceptance_${Date.now()}`,
        name: `Acceptance Project ${isoNowSuffix()}`,
        metadata: {
          platform: {
            accessScope: 'client',
            campaignName: 'Acceptance Matrix',
            brandName: 'Acceptance Brand',
          },
        },
        canvas: { presetId: 'custom' },
        scenes: [{ id: 'scene_acceptance', widgetIds: ['widget_acceptance'] }],
      },
      ui: {
        activeProjectId: `proj_acceptance_${Date.now()}`,
      },
    };

    await check('projects-list', async () => {
      const result = await request('/projects');
      return expect(result.ok, 'Project list failed', {
        status: result.status,
        count: result.body?.projects?.length ?? 0,
      });
    });

    await check('projects-save', async () => {
      const result = await request('/projects/save', {
        method: 'POST',
        body: JSON.stringify({ state: projectState }),
      });
      if (result.ok) projectId = result.body?.project?.id || '';
      return expect(result.ok && Boolean(projectId), 'Project save failed', {
        status: result.status,
        projectId,
      });
    });

    await check('projects-load', async () => {
      const result = await request(`/projects/${projectId}`);
      return expect(result.ok && Boolean(result.body?.state), 'Project load failed', {
        status: result.status,
        hasState: Boolean(result.body?.state),
      });
    });

    await check('projects-versions-list', async () => {
      const result = await request(`/projects/${projectId}/versions`);
      return expect(result.ok, 'Project version list failed', {
        status: result.status,
        count: result.body?.versions?.length ?? 0,
      });
    });

    await check('projects-versions-save', async () => {
      const result = await request(`/projects/${projectId}/versions`, {
        method: 'POST',
        body: JSON.stringify({ state: projectState, note: 'Acceptance checkpoint' }),
      });
      if (result.ok) versionId = result.body?.version?.id || '';
      return expect(result.ok && Boolean(versionId), 'Project version save failed', {
        status: result.status,
        versionId,
      });
    });

    await check('projects-versions-load', async () => {
      const result = await request(`/projects/${projectId}/versions/${versionId}`);
      return expect(result.ok && Boolean(result.body?.state), 'Project version load failed', {
        status: result.status,
        hasState: Boolean(result.body?.state),
      });
    });

    await check('projects-delete', async () => {
      const result = await request(`/projects/${projectId}`, { method: 'DELETE' });
      return expect(result.ok, 'Project delete failed', {
        status: result.status,
      });
    });
  }));

  domains.push(await runDomain('drafts_documents', 'Autosave document lifecycle', async ({ check }) => {
    const autosaveState = {
      document: {
        id: `doc_acceptance_${Date.now()}`,
        name: `Acceptance Autosave ${isoNowSuffix()}`,
        scenes: [{ id: 'scene_document', widgetIds: [] }],
      },
      ui: {
        activeProjectId: '',
      },
    };

    await check('documents-autosave-exists-before', async () => {
      const result = await request('/documents/autosave/exists');
      return expect(result.ok, 'Autosave exists check failed', {
        status: result.status,
        exists: Boolean(result.body?.exists),
      });
    });

    await check('documents-autosave-save', async () => {
      const result = await request('/documents/autosave', {
        method: 'POST',
        body: JSON.stringify({ state: autosaveState }),
      });
      return expect(result.ok, 'Autosave save failed', {
        status: result.status,
      });
    });

    await check('documents-autosave-exists-after-save', async () => {
      const result = await request('/documents/autosave/exists');
      return expect(result.ok && result.body?.exists === true, 'Autosave did not persist', {
        status: result.status,
        exists: Boolean(result.body?.exists),
      });
    });

    await check('documents-autosave-load', async () => {
      const result = await request('/documents/autosave');
      return expect(result.ok && Boolean(result.body?.state), 'Autosave load failed', {
        status: result.status,
        hasState: Boolean(result.body?.state),
      });
    });

    await check('documents-autosave-delete', async () => {
      const result = await request('/documents/autosave', { method: 'DELETE' });
      return expect(result.ok, 'Autosave delete failed', {
        status: result.status,
      });
    });

    const manualState = {
      document: {
        id: `manual_acceptance_${Date.now()}`,
        name: `Acceptance Manual Save ${isoNowSuffix()}`,
        scenes: [{ id: 'scene_manual_document', widgetIds: [] }],
      },
      ui: {
        activeProjectId: '',
      },
    };

    await check('documents-manual-exists-before', async () => {
      const result = await request('/documents/manual-save/exists');
      return expect(result.ok, 'Manual-save exists check failed', {
        status: result.status,
        exists: Boolean(result.body?.exists),
      });
    });

    await check('documents-manual-save', async () => {
      const result = await request('/documents/manual-save', {
        method: 'POST',
        body: JSON.stringify({ state: manualState }),
      });
      return expect(result.ok, 'Manual-save failed', {
        status: result.status,
      });
    });

    await check('documents-manual-exists-after-save', async () => {
      const result = await request('/documents/manual-save/exists');
      return expect(result.ok && result.body?.exists === true, 'Manual-save did not persist', {
        status: result.status,
        exists: Boolean(result.body?.exists),
      });
    });

    await check('documents-manual-load', async () => {
      const result = await request('/documents/manual-save');
      return expect(result.ok && Boolean(result.body?.state), 'Manual-save load failed', {
        status: result.status,
        hasState: Boolean(result.body?.state),
      });
    });

    await check('documents-manual-delete', async () => {
      const result = await request('/documents/manual-save', { method: 'DELETE' });
      return expect(result.ok, 'Manual-save delete failed', {
        status: result.status,
      });
    });
  }));

  domains.push(await runDomain('assets_uploads', 'Asset metadata CRUD and upload preparation', async ({ check }) => {
    let assetId = '';
    let binaryUpload = null;

    await check('assets-list', async () => {
      const result = await request('/assets');
      return expect(result.ok, 'Asset list failed', {
        status: result.status,
        count: result.body?.assets?.length ?? 0,
      });
    });

    await check('assets-create', async () => {
      const result = await request('/assets', {
        method: 'POST',
        body: JSON.stringify({
          asset: {
            name: `Acceptance Asset ${isoNowSuffix()}`,
            kind: 'image',
            src: 'https://cdn.example.com/acceptance-image.jpg',
            publicUrl: 'https://cdn.example.com/acceptance-image.jpg',
            sourceType: 'url',
            storageMode: 'remote-url',
            accessScope: 'client',
            tags: ['acceptance'],
          },
        }),
      });
      if (result.ok) assetId = result.body?.asset?.id || '';
      return expect(result.ok && Boolean(assetId), 'Asset create failed', {
        status: result.status,
        assetId,
      });
    });

    await check('assets-get', async () => {
      const result = await request(`/assets/${assetId}`);
      return expect(result.ok && Boolean(result.body?.asset), 'Asset fetch failed', {
        status: result.status,
        found: Boolean(result.body?.asset),
      });
    });

    await check('assets-rename', async () => {
      const result = await request(`/assets/${assetId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ name: `Acceptance Asset Renamed ${isoNowSuffix()}` }),
      });
      return expect(result.ok, 'Asset rename failed', {
        status: result.status,
      });
    });

    await check('assets-upload-url', async () => {
      const result = await request('/assets/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'acceptance-image.png',
          mimeType: 'image/png',
          requestedName: 'Acceptance Upload',
          sizeBytes: 128,
          accessScope: 'client',
          tags: ['acceptance', 'upload'],
        }),
      });
      return expect(result.ok && Boolean(result.body?.upload?.uploadUrl), 'Upload URL generation failed', {
        status: result.status,
        storageKey: result.body?.upload?.storageKey || '',
      });
    });

    if (includeUploadCompletion) {
      await check('assets-upload-completion:prepare', async () => {
        const result = await request('/assets/upload-url', {
          method: 'POST',
          body: JSON.stringify({
            filename: 'acceptance-upload.txt',
            mimeType: 'text/plain',
            requestedName: `Acceptance Binary Upload ${isoNowSuffix()}`,
            sizeBytes: 24,
            accessScope: 'client',
            tags: ['acceptance', 'binary-upload'],
          }),
        });
        if (result.ok) binaryUpload = result.body?.upload || null;
        return expect(result.ok && Boolean(binaryUpload?.uploadUrl), 'Binary upload preparation failed', {
          status: result.status,
          assetId: binaryUpload?.assetId || '',
          storageKey: binaryUpload?.storageKey || '',
        });
      });

      await check('assets-upload-completion:put-object', async () => {
        const result = await uploadBinaryToSignedUrl(
          binaryUpload?.uploadUrl || '',
          binaryUpload?.mimeType || 'text/plain',
          `acceptance-upload-${Date.now()}`,
        );
        return expect(result.ok, 'Direct binary upload to signed URL failed', {
          status: result.status,
        });
      });

      await check('assets-upload-completion:complete', async () => {
        const result = await request('/assets/complete-upload', {
          method: 'POST',
          body: JSON.stringify({
            assetId: binaryUpload?.assetId,
            name: binaryUpload?.name,
            kind: binaryUpload?.kind,
            mimeType: binaryUpload?.mimeType,
            sourceType: 'upload',
            storageMode: binaryUpload?.storageMode,
            storageKey: binaryUpload?.storageKey,
            publicUrl: binaryUpload?.publicUrl,
            accessScope: binaryUpload?.accessScope,
            tags: binaryUpload?.tags,
            folderId: binaryUpload?.folderId,
            sizeBytes: binaryUpload?.sizeBytes,
            fontFamily: binaryUpload?.fontFamily,
          }),
        });
        if (result.ok) binaryUpload = { ...binaryUpload, assetId: result.body?.asset?.id || binaryUpload?.assetId };
        return expect(result.ok && Boolean(result.body?.asset?.id), 'Upload completion failed', {
          status: result.status,
          assetId: result.body?.asset?.id || '',
        });
      });

      await check('assets-upload-completion:delete', async () => {
        const result = await request(`/assets/${binaryUpload?.assetId || ''}?purge=1`, { method: 'DELETE' });
        return expect(result.ok, 'Uploaded asset cleanup failed', {
          status: result.status,
        });
      });
    }

    await check('assets-delete', async () => {
      const result = await request(`/assets/${assetId}`, { method: 'DELETE' });
      return expect(result.ok, 'Asset delete failed', {
        status: result.status,
      });
    });
  }));

  domains.push(await runDomain('admin_observability_audit', 'Read-only admin endpoints and diagnostics', async ({ check }) => {
    await check('admin-audit-events', async () => {
      const result = await request('/admin/audit-events?limit=5');
      return expect(result.ok && Array.isArray(result.body?.events), 'Admin audit event inspection failed', {
        status: result.status,
        count: result.body?.events?.length ?? 0,
      });
    });

    await check('admin-assets-housekeeping', async () => {
      const result = await request('/admin/assets/housekeeping');
      return expect(result.ok && Boolean(result.body?.issues), 'Asset housekeeping inspection failed', {
        status: result.status,
        issueGroups: Object.keys(result.body?.issues || {}).length,
      });
    });
  }));

  const logoutResult = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const ok = domains.every((domain) => domain.ok);
  console.log(JSON.stringify({
    ok,
    baseUrl,
    expectedDriver,
    includeUploadCompletion,
    requestedDomains,
    domains,
    logout: {
      ok: logoutResult.ok,
      status: logoutResult.status,
    },
  }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    baseUrl,
    expectedDriver,
    includeUploadCompletion,
    requestedDomains,
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
