import { handleCreativeBindingRoutes } from './routes/router-bindings.mjs';
import { handleCreativeCatalogRoutes } from './routes/router-creatives.mjs';
import { handleCreativeIngestionRoutes } from './routes/router-ingestions.mjs';
import { handleCreativeVersionRoutes } from './routes/router-versions.mjs';

const ROUTERS = [
  handleCreativeCatalogRoutes,
  handleCreativeVersionRoutes,
  handleCreativeIngestionRoutes,
  handleCreativeBindingRoutes,
];

export async function handleCreativeRoutes(ctx) {
  for (const router of ROUTERS) {
    const result = await router(ctx);
    if (result !== false) return result;
  }

  return false;
}
