# MandaRion Platform — Codex Implementation Guide
## Sprints S40–S50: Full Integration Reference

This document is the authoritative technical reference for implementing the
S40–S50 changeset into the MandaRion monorepo. It covers every file changed,
every decision made, every integration step, and the complete validation sequence.

---

## 0. Repo State Assumptions

- Starting point: `MandaRion-audit-sprint44.zip` (the audited snapshot)
- All S42 import alias bugs are already fixed (`scripts/fix-broken-imports.mjs` was applied)
- S43 portal cutover YAMLs are present but use `YOUR_DOMAIN.com` placeholders
- The repo has no `node_modules` or `.git` — it is a filesystem snapshot

**Before doing anything else:**
```bash
# Install all dependencies including pg-boss (S49)
npm install

# Verify syntax is clean
npm run check:api
# Expected: 0 errors

# Verify tests pass
node --test packages/db/src/frequency-cap.test.mjs   # 15/15
node --test packages/db/src/tracking.test.mjs         # 7/7
```

---

## 1. Database Migrations — Run Before Any Deploy

Migrations are sequential. Run all of them in order.

```bash
npm run db:migrate
```

| Migration | Sprint | What it creates |
|-----------|--------|-----------------|
| `0022_tracker_write_functions.sql` | S40 | `tag_daily_stats`, `tag_engagement_daily_stats` tables |
| `0023_video_transcode_jobs.sql` | S44 | `video_transcode_jobs` table + migrates pending jobs from `asset_processing_jobs` |
| `0024_frequency_cap_events.sql` | S46 | `tag_frequency_cap_events` table |
| `0025_omid_verification_fields.sql` | S48 | Adds `omid_verification_vendor`, `omid_verification_js_url`, `omid_verification_params` to `ad_tags` |
| `0026_pgboss_schema.sql` | S49 | Creates `pgboss` schema (pg-boss creates its tables on first `PgBoss.start()`) |

**Verify after migration:**
```sql
-- S40
SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('tag_daily_stats','tag_engagement_daily_stats');

-- S44
SELECT status, COUNT(*) FROM video_transcode_jobs GROUP BY status;

-- S46
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'tag_frequency_cap_events';

-- S48
SELECT column_name FROM information_schema.columns WHERE table_name='ad_tags' AND column_name LIKE 'omid%';

-- S49
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'pgboss';
```

---

## 2. Infra / Environment Variables

### 2.1 DigitalOcean App Platform — Replace Placeholders

Three YAML files in `infra/do/` use placeholder values. **Replace before applying:**

```bash
# Find all placeholders
grep -r "YOUR_DOMAIN\|YOUR_ORG\|YOUR_REPO\|YOUR_ACCOUNT_ID\|REPLACE_ME" infra/do/
# Must return 0 lines before deployment
```

**`infra/do/backend.app.yaml`** — Critical env vars added in S43:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PLATFORM_ALLOWED_ORIGIN` | Portal domain for CORS cookie auth | `https://portal.YOUR_DOMAIN.com` |
| `CORS_ORIGIN` | Comma-separated allowed origins | `portal + app + studio` |
| `API_BASE_URL` | External API URL for VAST tracker URLs | `https://api.YOUR_DOMAIN.com` |
| `R2_PUBLIC_BASE` | CDN URL for R2 static VAST files | `https://assets.YOUR_DOMAIN.com` |
| `PLATFORM_COOKIE_SECURE` | Must be `"true"` in production | `"true"` |
| `TRACKER_FLUSH_INTERVAL_MS` | TrackerBuffer flush interval | `"5000"` |
| `TRACKER_FLUSH_THRESHOLD` | TrackerBuffer flush threshold | `"1000"` |
| `PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS` | pg-boss job retention | `3600` |
| `PGBOSS_ARCHIVE_FAILED_AFTER_SECONDS` | pg-boss failed job retention | `86400` |
| `PGBOSS_DELETE_AFTER_DAYS` | pg-boss archive purge | `7` |

**`infra/do/web.app.yaml`** — Added in S43:
- `VITE_PORTAL_URL=https://portal.YOUR_DOMAIN.com/launch` — **Required** for `ProductLauncher` to redirect to portal instead of showing inline launcher

**`infra/do/portal.app.yaml`** — All `example.com` replaced with `YOUR_DOMAIN.com`.

### 2.2 Cloudflare

Follow `infra/cloudflare/README.md` for DNS records, cache rules, WAF rate limits, and the cutover checklist.

---

## 3. Sprint-by-Sprint: Files Changed and What They Do

### S40 — Tracker Writes

**Problem:** Tracker endpoints (`impression.gif`, `/engagement`, `/click`) returned correct HTTP responses but wrote nothing to DB. `tag_daily_stats` was always empty.

**Files changed:**
- `packages/db/migrations/0022_tracker_write_functions.sql` — Creates tracking tables
- `packages/db/src/tracking.mjs` — `recordImpression`, `recordClick`, `recordEngagement`, `flushTrackerBatch`
- `apps/api/src/modules/adserver/tracker/routes.mjs` — New module, HTTP-first response then async write
- `apps/api/src/modules/adserver/tracker/tracker-buffer.mjs` — `TrackerBuffer` class, batches writes
- `apps/api/src/app.mjs` — Initializes `TrackerBuffer`, registers tracker routes before VAST
- `apps/api/src/server.mjs` — Graceful shutdown: SIGTERM/SIGINT → `buffer.stop()` → flush

**Key behavior:**
```
GET /v1/tags/tracker/:tagId/impression.gif
→ Respond 200 image/gif IMMEDIATELY
→ buffer.addImpression(tagId) AFTER response
→ Buffer flushes to DB every 5s or every 1000 events
```

**Validation:**
```bash
# Fire 5 impressions, wait 6s, check DB
curl https://api.YOUR_DOMAIN.com/v1/tags/tracker/<tagId>/impression.gif
# Then:
SELECT SUM(impressions) FROM tag_daily_stats WHERE tag_id='<tagId>' AND date=CURRENT_DATE;
```

---

### S41 — Static VAST → R2 Upload

**Problem:** `publishStaticVastProfiles` always set `storageKey: null`. Static VAST XML was stored in Postgres only. DSP URLs returned 404.

**Files changed:**
- `packages/r2/src/client.mjs` — `createR2Client`, `buildVastStorageKey`, null-object fallback
- `packages/r2/package.json` — New `@smx/r2` workspace
- `packages/db/src/vast.mjs` — `publishStaticVastProfiles` now takes `{ r2 }` third argument, uploads XML before persisting
- `apps/api/src/modules/adserver/vast/routes.mjs` — Injects R2 client into publish handlers

**Key behavior:**
```
POST /v1/vast/tags/:tagId/publish-static
→ buildLiveXmlForTagContext()
→ r2.putXml(key, xml)        ← NEW
→ upsertFormatMetadata()      ← storageKey now populated
→ response includes r2Uploaded: true
```

**R2 storage key format:** `vast/tags/{tagId}/{profile}.xml`

**CDN URL format:** `https://assets.YOUR_DOMAIN.com/vast/tags/{tagId}/{profile}.xml`

---

### S42 — Workspace Import Aliases + Bug Fix

**Problem:** `migrate-imports.mjs` had a bug converting relative imports to `@smx/*/src/<LINE_NUMBER>` instead of `@smx/*/src/<filename>.mjs`. 23 files were broken.

**Fix applied:** `scripts/fix-broken-imports.mjs` — Complete replacement table, verified with `node --check`.

**Current state:** 0 numeric imports. All `apps/api/src/**`, `apps/worker/src/**` use `@smx/*` aliases.

**`apps/api/package.json`** dependencies: `@smx/config`, `@smx/contracts`, `@smx/db`, `@smx/r2`
**`apps/worker/package.json`** dependencies: `@smx/db`, `pg-boss` (added S49)

---

### S43 — Portal Cutover

**Problem:** Three env vars missing from infra YAMLs caused the portal to be completely non-functional in production:
1. `PLATFORM_ALLOWED_ORIGIN` missing → CORS broken → portal can't authenticate
2. `VITE_PORTAL_URL` missing → `ProductLauncher` never redirected to portal
3. `R2_PUBLIC_BASE` missing → static VAST used API URL instead of CDN

**Files changed:**
- `infra/do/backend.app.yaml` — Complete rewrite with all S43 vars
- `infra/do/portal.app.yaml` — Placeholders replaced
- `infra/do/web.app.yaml` — `VITE_PORTAL_URL` added
- `infra/cloudflare/README.md` — Full DNS cutover checklist
- `apps/web/src/shell/ProductLauncher.tsx` — 172→109 lines, redirect-only
- `scripts/validate-portal-cutover.mjs` — 8-check E2E validation

**`ProductLauncher.tsx` logic after S43:**
```
hasAdServerAccess && !hasStudioAccess → navigate('/overview')  // skip portal
else if portalUrl set                  → window.location.assign(portalUrl)
else (dev, no portal)                  → show fallback UI
```

**Validate cutover:**
```bash
PORTAL_URL=https://portal.YOUR_DOMAIN.com \
API_URL=https://api.YOUR_DOMAIN.com \
node scripts/validate-portal-cutover.mjs
```

---

### S44 — Video Transcode State Machine

**Problem:** Transcode state was scattered across 4 sources. Stalled jobs never recovered. API did autorepair-on-GET.

**Files changed:**
- `packages/db/migrations/0023_video_transcode_jobs.sql` — New table + partial unique index + migrates pending jobs
- `packages/db/src/video-transcode-jobs.mjs` — Full DB layer: enqueue, claim, markProcessing, complete, fail, stall, requeue, reconcile
- `apps/worker/src/jobs/transcode-video.mjs` — Rewritten: claims from `video_transcode_jobs`, explicit state transitions
- `apps/worker/src/jobs/maintenance.mjs` — Added `reconcileStalledVideoTranscodeJobs`

**State machine:**
```
pending → claimed → processing → done
               ↓          ↓
            failed      failed
                        stalled → pending (if attempts < max, maintenance reconciler)
```

**`video_transcode_jobs` key columns:**
- `creative_version_id` — FK to creative_versions
- `status` — `pending|claimed|processing|done|failed|stalled`
- `source_url` — public URL of source video
- `target_plan` — JSONB `[{label, height, bitrateKbps}]`
- `output` — JSONB `{renditions: [...], posterUrl}`
- Unique partial index: `(creative_version_id) WHERE status IN ('pending','claimed','processing')`

**How the API reads transcode status (no more autorepair):**
```js
import { getVideoTranscodeJobForVersion, deriveTranscodeDisplayStatus } from '@smx/db/src/video-transcode-jobs.mjs';

// In GET /v1/creative-versions/:id handler:
const job = await getVideoTranscodeJobForVersion(pool, workspaceId, versionId);
const transcodeStatus = deriveTranscodeDisplayStatus(job);
// Returns: 'no_job'|'pending'|'processing'|'done'|'failed'|'stalled'
```

**How to enqueue a new transcode job:**
```js
import { enqueueVideoTranscodeJob } from '@smx/db/src/video-transcode-jobs.mjs';

await enqueueVideoTranscodeJob(client, {
  workspaceId,
  creativeVersionId,
  assetId,
  sourceUrl,           // public URL of the source video
  targetPlan: [
    { label: '1080p', height: 1080, bitrateKbps: 5000 },
    { label: '720p',  height: 720,  bitrateKbps: 2800 },
    { label: '480p',  height: 480,  bitrateKbps: 1400 },
  ],
  createdBy: session.user.id,
});
// ON CONFLICT DO NOTHING — safe to call multiple times
```

---

### S45 — Go/No-Go Audit

**Files changed:**
- `scripts/staging-s40-s44-audit.mjs` — Sprint-specific audit with tracker write verification
- `scripts/production-readiness-lib.mjs` — Extended with S40–S44 checklist items

**Run the full audit:**
```bash
SMOKE_BASE_URL=https://api.YOUR_DOMAIN.com \
SMOKE_LOGIN_EMAIL=admin@YOUR_DOMAIN.com \
SMOKE_LOGIN_PASSWORD=REPLACE_ME \
DATABASE_URL=postgres://... \
PORTAL_URL=https://portal.YOUR_DOMAIN.com \
npm run audit:s40-s44

# Combined go/no-go:
npm run audit:go-nogo
```

**Tracker write verification (most important check):** Fires 5 real impressions to a tag, waits 6s (buffer flush time), checks `tag_daily_stats` delta. If delta = 0, TrackerBuffer is not running or writes are failing.

---

### S46 — Frequency Cap + First-party Cookie

**Files changed:**
- `packages/db/migrations/0024_frequency_cap_events.sql` — `tag_frequency_cap_events` table
- `packages/db/src/frequency-cap.mjs` — `getTagFrequencyCap`, `checkFrequencyCap`, `recordFrequencyCapImpression`, `pruneFrequencyCapEvents`
- `apps/api/src/lib/device-id.mjs` — `resolveDeviceId` (read/generate `smx_uid` cookie)
- `apps/api/src/modules/adserver/tracker/routes.mjs` — Cookie emitted on impression/engagement/click
- `apps/api/src/modules/adserver/vast/routes.mjs` — Cap check before `getLiveVastXml`
- `apps/worker/src/jobs/maintenance.mjs` — `pruneFrequencyCapEvents(client, 30)`

**Cookie spec:**
```
Name:     smx_uid
Value:    UUID v4
Max-Age:  2592000 (30 days)
Path:     /v1/tags/tracker
SameSite: None (production, cross-site iframe context)
Secure:   true (production)
HttpOnly: false (must be readable by MRAID/WebView JS)
```

**Cap enforcement flow:**
```
GET /v1/vast/tags/:tagId/default.xml
→ readDeviceId(req)                           // read smx_uid
→ getTagFrequencyCap(pool, tagId)             // fetch cap + window from ad_tags
→ checkFrequencyCap(pool, {tagId, deviceId, cap, capWindow})
→ if capped: return <NoAd/> VAST 3.0
→ else: getLiveVastXml(...)
```

**Cap fields on `ad_tags`:**
- `frequency_cap` INTEGER — max impressions per window
- `frequency_cap_window` TEXT — `'daily'` or `'weekly'`

**Cap check is always fail-open:** DB error → serve VAST normally.

**`tag_frequency_cap_events` table:**
- `(tag_id, device_id, event_date)` UNIQUE — UPSERT increments counter
- `impressions` INTEGER — counter per (tag, device, day)

---

### S47 — Legacy Archive + Worker Stubs

**Files changed:**
- `legacy/cloudways/ARCHIVE.md` — Documents what's in the directory and when it's safe to delete
- `apps/worker/src/jobs/generate-thumbnails.mjs` — Explicit no-op with structured logging
- `apps/worker/src/jobs/extract-metadata.mjs` — Explicit no-op with structured logging

**Both stubs return:** `{ processed: 0, skipped: true, reason: 'not_implemented' }`

**When to implement thumbnails:** Use puppeteer/headless Chrome for HTML5 banner previews. Pattern: create `thumbnail_jobs` table, follow `video_transcode_jobs` pattern.

**When to delete legacy/cloudways:**
1. All workspaces migrated via `npm run db:import:legacy`
2. No live traffic to Cloudways (verify via Cloudflare analytics)
3. Cloudways environment decommissioned
4. Run: `git rm -r legacy/cloudways/`

---

### S48 — OMID + VASTTracker in Studio

**Problem:** `VASTTracker` from `packages/vast` was imported by `useVAST.ts` but OMID session management was missing. VAST XML had no `<AdVerifications>` block.

**Files changed:**
- `packages/db/migrations/0025_omid_verification_fields.sql` — 3 columns on `ad_tags`
- `packages/db/src/vast.mjs` — 4 patches: `getTagContext` reads OMID columns, `buildInlineXml` accepts OMID params, XML template includes `<AdVerifications>`, `buildLiveXmlForTagContext` passes OMID values
- `packages/vast/src/types.ts` — New `VASTAdVerification` type, `adVerifications` field on `VASTAd`
- `packages/vast/src/parser/vast-parser.ts` — `parseAdVerifications()` function, wired into `parseInLine`
- `apps/studio/src/widgets/video/OMIDSessionClient.ts` — `OMIDSession` class, `createOMIDSession` factory
- `apps/studio/src/widgets/video/useVAST.ts` — OMID lifecycle: create on ad load, start on play, relay events, finish on ended/skip

**OMID fields on `ad_tags`:**
```sql
omid_verification_vendor  TEXT  -- e.g. 'IAS', 'DoubleVerify'
omid_verification_js_url  TEXT  -- URL of vendor JS (triggers AdVerifications in XML)
omid_verification_params  TEXT  -- opaque params string
```

**VAST XML output when `omid_verification_js_url` is set:**
```xml
<AdVerifications>
  <Verification vendor="IAS">
    <JavaScriptResource apiFramework="omid" browserOptional="true">
      <![CDATA[https://cdn.ias.com/omid-verification.js]]>
    </JavaScriptResource>
    <VerificationParameters><![CDATA[vendor-specific-params]]></VerificationParameters>
  </Verification>
</AdVerifications>
```

**OMID session lifecycle in `useVAST`:**
```
resolveVAST() → ad.adVerifications[0].jsUrl
→ createOMIDSession(jsUrl, vendor, params)
→ omidRef.current = session

onPlayerPlay()   → session.start()
onTimeUpdate()   → session.sendEvent('firstQuartile'|'midpoint'|'thirdQuartile')
onPlayerMute()   → session.sendEvent('mute')
onPlayerEnded()  → session.sendEvent('complete') → session.finish()
onSkipClick()    → session.sendEvent('skip') → session.finish()
onPlayerError()  → session.sendEvent('error') → session.finish()
```

**To fully enable OMID in production:** Load IAB OM SDK via script tag: `<script src="https://cdn.iabtechlab.com/omid/v1.3/omid-v1.3.js"></script>`. The `OMIDSession` class picks up `window.OmidSessionClient` automatically.

---

### S49 — pg-boss Queue

**Problem:** Worker used `sleep(30s)` polling loop. Up to 30s latency on new job submission. No deduplication. No dead-letter queue.

**Files changed:**
- `packages/db/migrations/0026_pgboss_schema.sql` — Creates `pgboss` schema
- `apps/worker/src/queue.mjs` — pg-boss singleton, queue names, send helpers
- `apps/worker/src/worker.mjs` — Event-driven via `boss.work()`, maintenance heartbeat
- `packages/db/src/job-dispatch.mjs` — API-side dispatch (inserts directly into `pgboss.job`)
- `apps/worker/package.json` — Added `"pg-boss": "^10.1.6"`

**Queue names:**
```js
QUEUE.TRANSCODE_VIDEO    = 'smx.transcode-video'
QUEUE.IMAGE_DERIVATIVES  = 'smx.image-derivatives'
QUEUE.MAINTENANCE        = 'smx.maintenance'
```

**How the worker boots (new flow):**
```
1. ensureBossStarted()  → PgBoss.start() creates pgboss.* tables
2. registerHandlers()   → boss.work() for each queue
3. startMaintenanceHeartbeat(30s) → sends maintenance job every 30s
4. await new Promise(() => {})   → pg-boss event loop keeps process alive
```

**How to enqueue a job from the API:**
```js
import { dispatchTranscodeJob } from '@smx/db/src/job-dispatch.mjs';

// After creating video_transcode_jobs row:
await dispatchTranscodeJob(pool, creativeVersionId);
// Worker picks it up via LISTEN/NOTIFY immediately
```

**Job configuration:**
```js
// Transcode: singletonKey = creativeVersionId (one active job per version)
// retryLimit: 3, retryBackoff: true (60s → 120s → 240s), expireInSeconds: 900

// Maintenance: singletonKey = 'global', singletonSeconds: 25
// (deduplicates across 25s windows even with multiple workers)
```

**pg-boss env vars (all optional, have defaults):**
```
PGBOSS_ARCHIVE_COMPLETED_AFTER_SECONDS=3600  # archive completed jobs after 1h
PGBOSS_ARCHIVE_FAILED_AFTER_SECONDS=86400    # archive failed jobs after 24h
PGBOSS_DELETE_AFTER_DAYS=7                   # purge archive after 7 days
```

---

### S50 — Permission Hardening

**Problem:** `withSession()` and `hasPermission()` were duplicated across 17 and 10 route files respectively. Any bug fix required editing 17 files.

**Files changed:**
- `apps/api/src/lib/session.mjs` — NEW: `withSession`, `hasPermission`, `requirePermission`, `guardPermission`
- 17 route files — Removed local function definitions, now import from `lib/session.mjs`

**`session.mjs` API:**
```js
import { withSession, hasPermission, guardPermission } from '../../../lib/session.mjs';

// Basic usage (replaces the old local withSession):
return withSession(ctx, async (session) => {
  const data = await getData(session.client, session.session.activeWorkspaceId);
  return sendJson(res, 200, { data, requestId });
});

// With permission guard:
return withSession(ctx, guardPermission(ctx, 'projects:save', async (session) => {
  const created = await createCampaign(session.client, ...);
  return sendJson(res, 201, { campaign: created, requestId });
}));

// Direct permission check:
if (!hasPermission(session, 'audit:read')) {
  return forbidden(res, requestId);
}
```

**Permission matrix (from `auth/service.mjs`):**
| Role | Permissions |
|------|------------|
| `admin` | all permissions including `clients:create`, `clients:invite`, `brandkits:manage`, `audit:read` |
| `designer` (= editor) | `projects:create`, `projects:save`, `projects:delete`, `assets:create`, `assets:update`, `assets:delete` |
| `ad_ops` | editor permissions + `audit:read` |
| `reviewer` | read-only (`projects:view-client`, `assets:view-client`) |

**Endpoints that are correctly public (no auth required):**
- `GET /healthz`, `GET /readyz`, `GET /version`, `GET /observability`
- `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/auth/session`
- `GET /v1/tags/tracker/:tagId/impression.gif` (tracker — intentionally public)
- `GET /v1/tags/tracker/:tagId/engagement` (tracker — intentionally public)
- `GET /v1/tags/tracker/:tagId/click` (tracker — intentionally public)
- `GET /v1/vast/tags/:tagId` (VAST delivery — intentionally public, with cap check)

**Validate S50 (verify 401 on protected endpoints):**
```bash
# Should return 401 for all of these without a session cookie:
curl -s https://api.YOUR_DOMAIN.com/v1/campaigns | jq .code
curl -s https://api.YOUR_DOMAIN.com/v1/tags | jq .code
curl -s https://api.YOUR_DOMAIN.com/v1/assets | jq .code
```

---

## 4. Complete Deployment Sequence

### 4.1 Pre-deploy checklist

```bash
# 1. Replace all placeholders
grep -r "YOUR_DOMAIN\|YOUR_ORG\|YOUR_REPO\|YOUR_ACCOUNT_ID\|REPLACE_ME" infra/do/
# Must return 0 lines

# 2. Install dependencies
npm install

# 3. Verify syntax
npm run check:api
# Must be 0 errors

# 4. Run tests
node --test packages/db/src/frequency-cap.test.mjs
node --test packages/db/src/tracking.test.mjs
```

### 4.2 Deploy order

```bash
# 1. Apply migrations FIRST (before any app deploys)
npm run db:migrate

# 2. Deploy backend (API + worker together)
doctl apps update <BACKEND_APP_ID> --spec infra/do/backend.app.yaml
# Wait for ACTIVE state:
doctl apps get <BACKEND_APP_ID> --format Phase

# 3. Deploy portal
doctl apps update <PORTAL_APP_ID> --spec infra/do/portal.app.yaml

# 4. Deploy web (Ad Server)
doctl apps update <WEB_APP_ID> --spec infra/do/web.app.yaml
```

### 4.3 Post-deploy validation

```bash
# Step 1: Portal cutover validation
PORTAL_URL=https://portal.YOUR_DOMAIN.com \
API_URL=https://api.YOUR_DOMAIN.com \
WEB_URL=https://app.YOUR_DOMAIN.com \
node scripts/validate-portal-cutover.mjs

# Step 2: Sprint audit (requires DATABASE_URL for full coverage)
SMOKE_BASE_URL=https://api.YOUR_DOMAIN.com \
SMOKE_LOGIN_EMAIL=admin@YOUR_DOMAIN.com \
SMOKE_LOGIN_PASSWORD=REPLACE_ME \
DATABASE_URL=postgres://... \
PORTAL_URL=https://portal.YOUR_DOMAIN.com \
npm run audit:s40-s44

# Step 3: Full acceptance matrix
SMOKE_BASE_URL=https://api.YOUR_DOMAIN.com \
SMOKE_LOGIN_EMAIL=admin@YOUR_DOMAIN.com \
SMOKE_LOGIN_PASSWORD=REPLACE_ME \
STAGING_ACCEPTANCE_INCLUDE_UPLOAD_COMPLETION=true \
npm run staging:acceptance:matrix

# Step 4: Post-deploy check
SMOKE_BASE_URL=https://api.YOUR_DOMAIN.com \
npm run staging:post-deploy:check
```

### 4.4 First-run pg-boss verification

```bash
# After worker boots, logs should show:
# { "event": "pgboss_started" }
# { "event": "handlers_registered", "queues": ["smx.transcode-video", "smx.image-derivatives", "smx.maintenance"] }
# { "event": "job_start", "queue": "smx.maintenance" }  ← within 30s

# Check pgboss tables were created:
psql $DATABASE_URL -c "\dt pgboss.*"
# Should list: pgboss.job, pgboss.archive, pgboss.schedule, pgboss.version, etc.
```

---

## 5. Architecture Reference

### 5.1 Request flow — VAST with frequency cap

```
Browser/DSP
    │
    ▼
GET /v1/vast/tags/{tagId}/default.xml
    │
    ├─ readDeviceId(req)          → smx_uid cookie (or empty string)
    ├─ getTagFrequencyCap(pool)   → { cap: 5, capWindow: 'daily', workspaceId }
    ├─ checkFrequencyCap(pool)    → { capped: false, count: 2 }
    │
    ├─ [if capped]  → return <NoAd/> VAST 3.0
    │
    └─ [if not capped]
         └─ getLiveVastXml(pool, { tagId, profile, baseUrl })
              └─ getTagContext()         → tag + bindings + renditions + OMID fields
              └─ buildLiveXmlForTagContext()
                   └─ buildInlineXml({ ..., omidVerificationJsUrl })
                        └─ includes <AdVerifications> if jsUrl is set
```

### 5.2 Request flow — Impression tracking

```
Ad player
    │
    ▼
GET /v1/tags/tracker/{tagId}/impression.gif
    │
    ├─ resolveDeviceId(req)       → { deviceId, cookie: "smx_uid=..." or null }
    ├─ Set-Cookie: smx_uid=...    ← only if new cookie
    ├─ 200 image/gif              ← IMMEDIATE RESPONSE
    │
    └─ [async, after response]
         ├─ buffer.addImpression(tagId)         → S40 tracker buffer
         └─ getTagWorkspaceId(pool, tagId)
              └─ recordFrequencyCapImpression(pool, { tagId, deviceId, workspaceId })
```

### 5.3 Worker job lifecycle

```
API: enqueueVideoTranscodeJob(client, { creativeVersionId, sourceUrl, ... })
  → INSERT into video_transcode_jobs (status='pending')
  → dispatchTranscodeJob(pool, creativeVersionId)
       → INSERT into pgboss.job (name='smx.transcode-video', singletonKey=creativeVersionId)
            → pg-boss NOTIFY fires immediately

Worker receives via LISTEN/NOTIFY:
  handleTranscodeVideo(pgbossJob)
    → runTranscodeVideoJob()
         → claimNextVideoTranscodeJob(client)   ← FOR UPDATE SKIP LOCKED
         → markVideoTranscodeJobProcessing(client, jobId)
         → [ffmpeg transcodes + R2 uploads]
         → completeVideoTranscodeJob(client, jobId, output)
         → syncCreativeVideoTranscodeOutputs()

Maintenance (every 30s heartbeat):
  → reconcileStalledVideoTranscodeJobs()
       → findStalledVideoTranscodeJobs()  ← WHERE status='processing' AND updated_at < NOW()-15min
       → stallVideoTranscodeJob()
       → requeueStalledVideoTranscodeJob() ← IF attempts < max_attempts
  → pruneFrequencyCapEvents(30 days)
  → expirePendingUploadSessions()
  → revokeExpiredSessions()
  → pruneOldDrafts()
```

### 5.4 Module dependency graph

```
@smx/config       ← env vars, no runtime deps
@smx/contracts    ← TypeScript types only
@smx/r2           ← @aws-sdk/client-s3
@smx/db           ← pg, @aws-sdk/client-s3, @smx/r2 (relative import in vast.mjs)
@smx/vast         ← no runtime deps (browser + server)

apps/api          ← @smx/config, @smx/contracts, @smx/db, @smx/r2
apps/worker       ← @smx/db, @aws-sdk/client-s3, ffmpeg-static, sharp, pg-boss
apps/studio       ← @smx/contracts, @smx/vast (TypeScript)
apps/web          ← @smx/contracts (TypeScript)
apps/portal       ← standalone React app
```

---

## 6. New npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run validate:portal-cutover` | Run `scripts/validate-portal-cutover.mjs` |
| `npm run audit:s40-s44` | Run `scripts/staging-s40-s44-audit.mjs` |
| `npm run audit:go-nogo` | `production:readiness:evaluate && audit:s40-s44` |
| `npm run migrate:imports` | Fix broken `@smx/*/src/<number>` imports |
| `npm run validate:legacy-migration` | Check platform_role, product_access data integrity |

---

## 7. Known Deferred Items (post S50)

These were explicitly out of scope for S40–S50 but should be tracked:

1. **OMID SDK loading** — `OMIDSessionClient.ts` is ready but requires loading `window.OmidSessionClient` externally. Add `<script src="https://cdn.iabtechlab.com/omid/v1.3/omid-v1.3.js">` to the Studio shell.

2. **`generate-thumbnails.mjs`** — Currently a no-op. Implement with puppeteer for HTML5 banner preview images when needed.

3. **`extract-metadata.mjs`** — Currently a no-op. Implement with `ffprobe` for background metadata extraction of assets uploaded via external URL.

4. **`legacy/cloudways/` deletion** — Safe to delete after confirming no live Cloudways traffic and all workspaces migrated.

5. **`dispatchTranscodeJob` in API routes** — `job-dispatch.mjs` exists but callers in `apps/api/src/modules/adserver/creatives/routes.mjs` still use `enqueueVideoTranscodeJob` from `asset-jobs.mjs` (the old table). After confirming `video_transcode_jobs` is stable, update the publish flow to also call `dispatchTranscodeJob` for immediate pg-boss dispatch.

6. **VPAID sunset / SIMID** — The VAST delivery layer is OMID-ready. SIMID (`InteractiveCreativeFile`) is parsed but no SIMID player is implemented in Studio.

---

## 8. File Index — All New/Changed Files by Sprint

### S40
- `packages/db/migrations/0022_tracker_write_functions.sql` ← NEW
- `packages/db/src/tracking.mjs` ← UPDATED (added write functions)
- `apps/api/src/modules/adserver/tracker/routes.mjs` ← NEW MODULE
- `apps/api/src/modules/adserver/tracker/tracker-buffer.mjs` ← NEW
- `apps/api/src/app.mjs` ← UPDATED
- `apps/api/src/server.mjs` ← UPDATED (graceful shutdown)

### S41
- `packages/r2/src/client.mjs` ← NEW PACKAGE
- `packages/r2/package.json` ← NEW
- `packages/db/src/vast.mjs` ← UPDATED (R2 injection)
- `apps/api/src/modules/adserver/vast/routes.mjs` ← UPDATED

### S42
- `apps/api/package.json` ← UPDATED (workspace deps)
- `apps/worker/package.json` ← UPDATED
- `scripts/fix-broken-imports.mjs` ← NEW (post-audit fix)
- `scripts/migrate-imports.mjs` ← UPDATED
- `scripts/validate-legacy-migration.mjs` ← NEW

### S43
- `infra/do/backend.app.yaml` ← COMPLETE REWRITE
- `infra/do/portal.app.yaml` ← UPDATED (placeholders replaced)
- `infra/do/web.app.yaml` ← UPDATED (VITE_PORTAL_URL added)
- `infra/cloudflare/README.md` ← REWRITTEN
- `apps/web/src/shell/ProductLauncher.tsx` ← SIMPLIFIED
- `scripts/validate-portal-cutover.mjs` ← NEW

### S44
- `packages/db/migrations/0023_video_transcode_jobs.sql` ← NEW
- `packages/db/src/video-transcode-jobs.mjs` ← NEW
- `apps/worker/src/jobs/transcode-video.mjs` ← REWRITTEN
- `apps/worker/src/jobs/maintenance.mjs` ← UPDATED (reconciler added)

### S45
- `scripts/staging-s40-s44-audit.mjs` ← NEW
- `scripts/production-readiness-lib.mjs` ← UPDATED (S40–S44 items)
- `package.json` ← UPDATED (new audit scripts)

### S46
- `packages/db/migrations/0024_frequency_cap_events.sql` ← NEW
- `packages/db/src/frequency-cap.mjs` ← NEW
- `apps/api/src/lib/device-id.mjs` ← NEW
- `apps/api/src/modules/adserver/tracker/routes.mjs` ← UPDATED (smx_uid + cap recording)
- `apps/api/src/modules/adserver/vast/routes.mjs` ← UPDATED (cap check)
- `apps/worker/src/jobs/maintenance.mjs` ← UPDATED (pruneFrequencyCapEvents)

### S47
- `legacy/cloudways/ARCHIVE.md` ← NEW
- `apps/worker/src/jobs/generate-thumbnails.mjs` ← UPDATED (explicit no-op)
- `apps/worker/src/jobs/extract-metadata.mjs` ← UPDATED (explicit no-op)

### S48
- `packages/db/migrations/0025_omid_verification_fields.sql` ← NEW
- `packages/db/src/vast.mjs` ← UPDATED (4 patches: OMID fields + AdVerifications XML)
- `packages/vast/src/types.ts` ← UPDATED (VASTAdVerification, adVerifications on VASTAd)
- `packages/vast/src/parser/vast-parser.ts` ← UPDATED (parseAdVerifications)
- `apps/studio/src/widgets/video/OMIDSessionClient.ts` ← NEW
- `apps/studio/src/widgets/video/useVAST.ts` ← UPDATED (OMID session lifecycle)

### S49
- `packages/db/migrations/0026_pgboss_schema.sql` ← NEW
- `packages/db/src/job-dispatch.mjs` ← NEW
- `apps/worker/src/queue.mjs` ← NEW
- `apps/worker/src/worker.mjs` ← REWRITTEN (pg-boss event-driven)
- `apps/worker/package.json` ← UPDATED (pg-boss dependency)

### S50
- `apps/api/src/lib/session.mjs` ← NEW
- 17× `apps/api/src/modules/*/routes.mjs` ← UPDATED (import from lib/session.mjs)

---

*End of Codex Implementation Guide — MandaRion Platform S40–S50*
