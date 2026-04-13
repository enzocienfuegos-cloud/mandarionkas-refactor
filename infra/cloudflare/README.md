# Cloudflare setup

## DNS

Create proxied records for:

- `app.example.com` → DigitalOcean Static Site default ingress
- `api.example.com` → DigitalOcean API ingress
- `assets.example.com` → Cloudflare R2 custom domain

## TLS

- Use **Full (strict)**.
- Install Cloudflare Origin CA certificates on DigitalOcean origins.
- Keep browser-facing traffic proxied through Cloudflare.

## Cache rules

- Bypass cache for `api.example.com/*`
- Cache hashed frontend assets aggressively on `app.example.com`
- Cache public asset objects on `assets.example.com`

## Security rules

- Rate-limit `POST /v1/auth/login`
- Rate-limit `POST /v1/assets/uploads`, `POST /v1/assets/upload-url`, `POST /v1/assets/complete-upload`, and `POST /v1/assets/uploads/*/complete`
- Turn on managed WAF rules for `app` and `api`
- Keep `assets` behind the custom domain, not `r2.dev`

## Origin health / cutover

- Check `https://api.example.com/readyz` until it returns `200`
- Run the smoke check after DNS switch: `SMOKE_BASE_URL=https://api.example.com npm run smoke:api`
- Watch worker logs for maintenance activity during the first production window

## R2

- Use R2 only for binary objects
- Do not store business JSON documents in R2
- Metadata, ownership and folder hierarchy belong in PostgreSQL
