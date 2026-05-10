# Architecture guardrails

These tests protect the studio from slipping back into hidden coupling.

Current rules:
- UI layers cannot import legacy repositories, raw storage modules, `platform/store`, or `studio-store` directly.
- Raw `fetch()` is limited to network adapters.
- Raw `localStorage` / `sessionStorage` is limited to approved browser adapters.
- `domain/` cannot depend on `export/`, `app/`, `platform/`, or `repositories/`.

Run with:
- `npm run test:architecture`
- `npm run check`
