# Shared contracts

This package is the new source of truth for API DTOs and contract evolution.

For this first refactor pass the existing frontend still imports some DTOs from its local copy under `apps/web/src/types/contracts`.
The next sprint should flip those imports to `@smx/contracts` and generate OpenAPI from here.
