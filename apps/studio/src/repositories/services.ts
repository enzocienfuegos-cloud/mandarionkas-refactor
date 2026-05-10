import type { AssetRepository, BrandKitRepository, DocumentRepository, ProjectRepository, ProjectVersionRepository } from './types';
import { apiAssetRepository } from './asset/api';
import { browserStorageAssetRepository } from './asset/local';
import { apiBrandKitRepository } from './brand-kit/api';
import { localBrandKitRepository } from './brand-kit/local';
import { apiDocumentRepository } from './document/api';
import { browserStorageDocumentRepository } from './document/local';
import { getAssetRepositoryMode, getBrandKitRepositoryMode, getDocumentRepositoryMode, getProjectRepositoryMode } from './mode';
import { apiProjectRepository } from './project/api';
import { localProjectRepository } from './project/local';
import { apiProjectVersionRepository } from './project-versions/api';
import { localProjectVersionRepository } from './project-versions/local';

export type RepositoryServices = {
  assets: AssetRepository;
  brandKits: BrandKitRepository;
  documents: DocumentRepository;
  projects: ProjectRepository;
  projectVersions: ProjectVersionRepository;
};

export type RepositoryServicesResolver = () => RepositoryServices;

function getDefaultRepositoryServices(): RepositoryServices {
  const projectMode = getProjectRepositoryMode();
  const documentMode = getDocumentRepositoryMode();
  const assetMode = getAssetRepositoryMode();
  const brandKitMode = getBrandKitRepositoryMode();
  return {
    assets: assetMode === 'local' ? browserStorageAssetRepository : apiAssetRepository,
    brandKits: brandKitMode === 'local' ? localBrandKitRepository : apiBrandKitRepository,
    documents: documentMode === 'local' ? browserStorageDocumentRepository : apiDocumentRepository,
    projects: projectMode === 'local' ? localProjectRepository : apiProjectRepository,
    projectVersions: projectMode === 'local' ? localProjectVersionRepository : apiProjectVersionRepository,
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
