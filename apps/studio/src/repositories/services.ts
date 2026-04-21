import type { AssetRepository, DocumentRepository, ProjectRepository, ProjectVersionRepository } from './types';
import { apiAssetRepository } from './asset/api';
import { apiDocumentRepository } from './document/api';
import { apiProjectRepository } from './project/api';
import { apiProjectVersionRepository } from './project-versions/api';

export type RepositoryServices = {
  assets: AssetRepository;
  documents: DocumentRepository;
  projects: ProjectRepository;
  projectVersions: ProjectVersionRepository;
};

export type RepositoryServicesResolver = () => RepositoryServices;

function getDefaultRepositoryServices(): RepositoryServices {
  return {
    assets: apiAssetRepository,
    documents: apiDocumentRepository,
    projects: apiProjectRepository,
    projectVersions: apiProjectVersionRepository,
  };
}

let resolver: RepositoryServicesResolver = () => getDefaultRepositoryServices();

export function getRepositoryServices(): RepositoryServices {
  return resolver();
}

export function configureRepositoryServices(nextResolver: RepositoryServicesResolver): void {
  resolver = nextResolver;
}

export function resetRepositoryServices(): void {
  resolver = () => getDefaultRepositoryServices();
}
