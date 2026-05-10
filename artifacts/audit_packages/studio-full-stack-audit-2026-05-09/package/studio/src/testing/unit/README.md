# Sprint 46 test suite base

This folder contains the first automated unit tests for the studio core.

Coverage focus for this sprint:
- history manager
- diagnostics / summaries
- reducer slices for widgets
- selector utilities
- local repositories

Run with:

```bash
npm test
```


Expanded in Sprint 50:
- export engine
- timeline helpers
- asset repository
- platform store


## Expanded coverage in Sprint 51
- conditions and scene flow resolvers
- API repository adapters with fetch mocks
- platform auth/invite flows


## Smoke tests
- `src/testing/smoke/editor-authoring-flow.test.ts`
- `src/testing/smoke/project-workspace-flow.test.ts`
- `src/testing/smoke/document-persistence-flow.test.ts`
