# Release Checks

This project treats these as the baseline release checks:

- `npm run repo:policy`
- `npm run typecheck`
- `npm run build`

For local packaging:

```bash
npm run release:check
npm run release:package
```

Notes:

- `vitest` smoke/unit tests exist under `src/testing`, but are not part of `release:check`.
- Some sandboxed environments do not have `node_modules`; in those cases only structural and syntax checks can be verified until dependencies are installed.
