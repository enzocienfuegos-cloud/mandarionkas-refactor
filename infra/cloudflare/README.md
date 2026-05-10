# Cloudflare Setup — S43 Portal Cutover (updated S51)

## Hostnames

Replace `YOUR_DOMAIN.com` with your actual domain everywhere below.

| Hostname | Purpose | Target |
|---|---|---|
| `portal.YOUR_DOMAIN.com` | Portal (unified launcher + identity) | DO Portal Static Site |
| `app.YOUR_DOMAIN.com` | Ad Server web app (apps/web) | DO Web Static Site |
| `studio.YOUR_DOMAIN.com` | Studio frontend (apps/studio) | DO Studio Static Site |
| `api.YOUR_DOMAIN.com` | API backend (apps/api) | DO API Service |
| `assets.YOUR_DOMAIN.com` | CDN for R2 binary objects | Cloudflare R2 custom domain |

**Canonical entrypoint after S43:** `portal.YOUR_DOMAIN.com`

---

## DNS records

Create these proxied (orange cloud) CNAME records in Cloudflare:

```
portal.YOUR_DOMAIN.com  CNAME  <DO-portal-app-ingress>.ondigitalocean.app
app.YOUR_DOMAIN.com     CNAME  <DO-web-app-ingress>.ondigitalocean.app
studio.YOUR_DOMAIN.com  CNAME  <DO-studio-app-ingress>.ondigitalocean.app
api.YOUR_DOMAIN.com     CNAME  <DO-api-service-ingress>.ondigitalocean.app
assets.YOUR_DOMAIN.com  CNAME  <R2-bucket>.r2.cloudflarestorage.com
```

Get the DO ingress URLs:
```bash
doctl apps list
doctl apps get <APP_ID> --format DefaultIngress
```

---

## TLS

- Use **Full (strict)** SSL mode.
- Cloudflare handles browser-facing certificate.
- DigitalOcean handles origin certificate (auto-managed by App Platform).
- `PLATFORM_COOKIE_SECURE=true` requires HTTPS — confirm before enabling.

---

## Cache rules (Cloudflare dashboard → Cache Rules)

Order matters — rules are evaluated top to bottom, first match wins.

### Rule 1: Bypass cache for API
```
If hostname equals api.YOUR_DOMAIN.com
→ Cache: Bypass
```

### Rule 2: Never cache HTML documents (SPA shells)
```
If hostname in {portal.YOUR_DOMAIN.com, app.YOUR_DOMAIN.com, studio.YOUR_DOMAIN.com}
AND (
  URI path equals /
  OR URI path equals /index.html
  OR URI path equals /404.html
  OR not URI path starts with /assets/
)
→ Cache: Bypass
```

**Why this rule exists and must come before Rule 3:**
DigitalOcean static sites return `cache-control: public, s-maxage=86400` on
HTML responses. Without this rule, Cloudflare caches the HTML (including 404
responses) for up to 24 hours. When a user navigates to `/overview` for the
first time, the origin returns a 404 (the file doesn't exist — the SPA shell
handles this route). Cloudflare caches that 404 for 86400 seconds. Every
subsequent visitor gets the cached 404 until the edge TTL expires.

The fix has two parts:
1. This cache rule prevents Cloudflare from caching HTML responses at all.
2. The `catchall_document: 404.html` in the DO app yaml ensures the origin
   serves the SPA shell (not a real 404) for any unknown path.

Both parts are required. Either alone is insufficient.

### Rule 3: Cache hashed frontend assets forever
```
If hostname in {portal.YOUR_DOMAIN.com, app.YOUR_DOMAIN.com, studio.YOUR_DOMAIN.com}
AND URI path starts with /assets/
→ Cache: Standard, Browser TTL: 1 year, Edge TTL: 1 year
```

Assets are content-hashed by Vite (e.g. `index-CvN4BgHj.js`). They are safe
to cache indefinitely — a new deploy produces new filenames.

### Rule 4: Cache R2 objects
```
If hostname equals assets.YOUR_DOMAIN.com
→ Cache: Standard, Browser TTL: 5 minutes, Edge TTL: 5 minutes
```

---

## ⚠️ After every deploy: purge HTML from Cloudflare edge cache

Cloudflare may have cached old HTML from before Rule 2 was in place, or from
a previous broken deploy. After any frontend deploy, purge by URL:

**Cloudflare dashboard → Caching → Cache Purge → Purge by URL:**

```
https://app.YOUR_DOMAIN.com/
https://app.YOUR_DOMAIN.com/index.html
https://app.YOUR_DOMAIN.com/404.html
https://portal.YOUR_DOMAIN.com/
https://portal.YOUR_DOMAIN.com/index.html
https://portal.YOUR_DOMAIN.com/404.html
https://studio.YOUR_DOMAIN.com/
https://studio.YOUR_DOMAIN.com/index.html
https://studio.YOUR_DOMAIN.com/404.html
```

Or via API (faster, scriptable):
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{
    "files": [
      "https://app.YOUR_DOMAIN.com/",
      "https://app.YOUR_DOMAIN.com/index.html",
      "https://app.YOUR_DOMAIN.com/404.html",
      "https://portal.YOUR_DOMAIN.com/",
      "https://portal.YOUR_DOMAIN.com/index.html",
      "https://portal.YOUR_DOMAIN.com/404.html",
      "https://studio.YOUR_DOMAIN.com/",
      "https://studio.YOUR_DOMAIN.com/index.html",
      "https://studio.YOUR_DOMAIN.com/404.html"
    ]
  }'
```

Add this to your deploy script or CI pipeline.

---

## Security rules (Cloudflare WAF → Rate Limiting)

### Login rate limit
```
Expression: http.request.method eq "POST" AND http.request.uri.path eq "/v1/auth/login"
Action: Block — 10 requests / 60 seconds per IP
```

### Upload rate limit
```
Expression: http.request.method eq "POST" AND http.request.uri.path matches "^/v1/assets/"
Action: Block — 20 requests / 60 seconds per IP
```

Enable **Cloudflare Managed Ruleset** for all four app hostnames.

---

## DNS cutover checklist

### Pre-cutover
- [ ] Deploy backend with `PLATFORM_ALLOWED_ORIGIN=https://portal.YOUR_DOMAIN.com`
- [ ] Deploy web with `VITE_PORTAL_URL=https://portal.YOUR_DOMAIN.com`
- [ ] Deploy portal with real `VITE_*` URLs
- [ ] Run: `PORTAL_URL=https://portal.YOUR_DOMAIN.com API_URL=https://api.YOUR_DOMAIN.com node scripts/validate-portal-cutover.mjs`

### DNS change
- [ ] Create `portal.YOUR_DOMAIN.com` CNAME → portal DO ingress
- [ ] Wait for propagation (< 5 min with Cloudflare)
- [ ] Verify: `curl -I https://portal.YOUR_DOMAIN.com` → HTTP 200
- [ ] Login flow works end-to-end in browser

### Post-cutover
- [ ] Re-run `validate-portal-cutover.mjs`
- [ ] Run `npm run staging:post-deploy:check`
- [ ] **Purge Cloudflare HTML cache** (see section above)
- [ ] Manual: login → workspace → Ad Server → portal → Studio

---

## R2 custom domain setup

1. Cloudflare R2 dashboard → your bucket → Settings → Custom Domains
2. Add `assets.YOUR_DOMAIN.com`
3. Cloudflare creates DNS record automatically
4. Wait for SSL provisioning (< 5 min)

---

## Smoke check after any deploy

```bash
PORTAL_URL=https://portal.YOUR_DOMAIN.com \
API_URL=https://api.YOUR_DOMAIN.com \
WEB_URL=https://app.YOUR_DOMAIN.com \
node scripts/validate-portal-cutover.mjs
```
