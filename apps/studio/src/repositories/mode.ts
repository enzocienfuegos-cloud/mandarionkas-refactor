export type RepositoryMode = 'local' | 'api';

export function getProjectRepositoryMode(): RepositoryMode { return 'api'; }
export function setProjectRepositoryMode(_mode: RepositoryMode): void {}

export function getAssetRepositoryMode(): RepositoryMode { return 'api'; }
export function setAssetRepositoryMode(_mode: RepositoryMode): void {}

export function getDocumentRepositoryMode(): RepositoryMode { return 'api'; }
export function setDocumentRepositoryMode(_mode: RepositoryMode): void {}
