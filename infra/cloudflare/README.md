# Cloudflare Setup — S43 Portal Cutover

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

### Rule 1: Bypass cache for API
```
If hostname equals api.YOUR_DOMAIN.com → Cache: Bypass
```

### Rule 2: Cache hashed frontend assets
```
If hostname in {portal.YOUR_DOMAIN.com, app.YOUR_DOMAIN.com, studio.YOUR_DOMAIN.com}
AND URI path matches /assets/*
→ Cache: Standard, Browser TTL: 1 year
```

### Rule 3: Cache R2 objects
```
If hostname equals assets.YOUR_DOMAIN.com
→ Cache: Standard, Browser TTL: 5 minutes, Edge TTL: 5 minutes
```

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
- [ ] Deploy web with `VITE_PORTAL_URL=https://portal.YOUR_DOMAIN.com/launch`
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
