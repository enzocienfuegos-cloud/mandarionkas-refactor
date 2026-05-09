export type RepositoryMode = 'local' | 'api';

import { canUseBrowserStorage, readStorageItem, writeStorageItem } from '../shared/browser/storage';

const PROJECT_MODE_KEY = 'smx-studio-v4:repository-mode:project';
const ASSET_MODE_KEY = 'smx-studio-v4:repository-mode:asset';
const DOCUMENT_MODE_KEY = 'smx-studio-v4:repository-mode:document';

function readMode(key: string): RepositoryMode {
  if (!canUseBrowserStorage()) return 'api';
  const raw = readStorageItem(key, 'api');
  return raw === 'local' ? 'local' : 'api';
}

function writeMode(key: string, mode: RepositoryMode): void {
  if (!canUseBrowserStorage()) return;
  writeStorageItem(key, mode);
}

export function getProjectRepositoryMode(): RepositoryMode { return readMode(PROJECT_MODE_KEY); }
export function setProjectRepositoryMode(mode: RepositoryMode): void { writeMode(PROJECT_MODE_KEY, mode); }

export function getAssetRepositoryMode(): RepositoryMode { return readMode(ASSET_MODE_KEY); }
export function setAssetRepositoryMode(mode: RepositoryMode): void { writeMode(ASSET_MODE_KEY, mode); }

export function getDocumentRepositoryMode(): RepositoryMode { return readMode(DOCUMENT_MODE_KEY); }
export function setDocumentRepositoryMode(mode: RepositoryMode): void { writeMode(DOCUMENT_MODE_KEY, mode); }
