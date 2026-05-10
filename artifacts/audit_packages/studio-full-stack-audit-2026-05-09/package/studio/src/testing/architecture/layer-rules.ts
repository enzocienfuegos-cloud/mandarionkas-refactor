export type LayerName =
  | 'actions'
  | 'app'
  | 'assets'
  | 'canvas'
  | 'core'
  | 'domain'
  | 'export'
  | 'hooks'
  | 'inspector'
  | 'integrations'
  | 'persistence'
  | 'platform'
  | 'repositories'
  | 'shared'
  | 'timeline'
  | 'types'
  | 'widgets';

export const layerRules: Record<LayerName, readonly LayerName[]> = {
  actions: ['domain', 'shared', 'types'],
  app: ['assets', 'canvas', 'core', 'domain', 'export', 'hooks', 'inspector', 'platform', 'repositories', 'shared', 'timeline', 'types', 'widgets'],
  assets: ['domain', 'platform', 'repositories', 'shared', 'types'],
  canvas: ['actions', 'core', 'domain', 'hooks', 'platform', 'shared', 'types', 'widgets'],
  core: ['actions', 'domain', 'shared', 'types', 'widgets'],
  domain: ['shared', 'types'],
  export: ['assets', 'domain', 'repositories', 'shared', 'types', 'widgets'],
  hooks: ['core', 'domain', 'shared', 'types'],
  inspector: ['app', 'assets', 'core', 'domain', 'export', 'hooks', 'platform', 'repositories', 'shared', 'types', 'widgets'],
  integrations: ['shared', 'types'],
  persistence: ['core', 'hooks', 'repositories', 'shared', 'types'],
  platform: ['app', 'domain', 'repositories', 'shared', 'types'],
  repositories: ['assets', 'domain', 'platform', 'shared', 'types'],
  shared: ['types'],
  timeline: ['core', 'hooks', 'shared', 'types', 'widgets'],
  types: [],
  widgets: ['assets', 'canvas', 'core', 'domain', 'export', 'hooks', 'inspector', 'platform', 'repositories', 'shared', 'types'],
};

export const layerOrder: readonly LayerName[] = [
  'actions',
  'app',
  'assets',
  'canvas',
  'core',
  'domain',
  'export',
  'hooks',
  'inspector',
  'integrations',
  'persistence',
  'platform',
  'repositories',
  'shared',
  'timeline',
  'types',
  'widgets',
] as const;
