import { configurePlatformServices, getPlatformServices } from '../../platform/services';
import { configureRepositoryContextResolver } from '../../repositories/context';
import { getPlatformRepositoryContext } from '../../platform/runtime';

let configured = false;

export function configureRuntimeDependencies(): void {
  if (configured) return;
  configurePlatformServices(getPlatformServices());
  configureRepositoryContextResolver(() => getPlatformRepositoryContext());
  configured = true;
}
