# Database

Use DigitalOcean Managed PostgreSQL as the single source of truth.

- Runtime API traffic should use `DATABASE_POOL_URL`.
- Schema migrations and one-shot data imports should use `DATABASE_URL`.
- Files stay in Cloudflare R2; only metadata lives in PostgreSQL.

## Legacy import

The legacy importer is a one-shot bridge out of the old Cloudways JSON store.

Run a dry-run report first:

```bash
npm run db:import:legacy -- --source-dir ./legacy-export
```

Apply the import into PostgreSQL:

```bash
DATABASE_URL=postgres://... npm run db:import:legacy -- --source-dir ./legacy-export --apply --reset-target
```

The importer can also read directly from the legacy R2 layout when these env vars are present:

- `LEGACY_R2_ENDPOINT`
- `LEGACY_R2_BUCKET`
- `LEGACY_R2_ACCESS_KEY_ID`
- `LEGACY_R2_SECRET_ACCESS_KEY`
- optional: `LEGACY_PLATFORM_API_DATA_KEY`
- optional: `LEGACY_PLATFORM_API_DATA_PREFIX`

Reports are written by default to:

- `artifacts/legacy-import-report.json`
- `artifacts/legacy-import-report.md`
