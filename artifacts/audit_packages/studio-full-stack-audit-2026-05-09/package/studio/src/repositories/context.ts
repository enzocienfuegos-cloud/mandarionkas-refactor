import type { PlatformRepositoryContext } from '../platform/runtime';
import { getPlatformRepositoryContext } from '../platform/runtime';

export type RepositoryContextResolver = () => PlatformRepositoryContext;

let resolver: RepositoryContextResolver = () => getPlatformRepositoryContext();

export function configureRepositoryContextResolver(nextResolver: RepositoryContextResolver): void {
  resolver = nextResolver;
}

export function getRepositoryContext(): PlatformRepositoryContext {
  return resolver();
}

export function resetRepositoryContextResolver(): void {
  resolver = () => getPlatformRepositoryContext();
}
