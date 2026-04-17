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
  assets: ['shared', 'types'],
  canvas: ['actions', 'core', 'domain', 'hooks', 'shared', 'types', 'widgets'],
  core: ['actions', 'domain', 'shared', 'types', 'widgets'],
  domain: ['shared', 'types'],
  export: ['domain', 'shared', 'types', 'widgets'],
  hooks: ['core', 'domain', 'shared', 'types'],
  inspector: ['assets', 'core', 'domain', 'export', 'hooks', 'platform', 'repositories', 'shared', 'types', 'widgets'],
  integrations: ['shared', 'types'],
  persistence: ['core', 'hooks', 'repositories', 'shared', 'types'],
  platform: ['app', 'shared', 'types'],
  repositories: ['assets', 'domain', 'platform', 'shared', 'types'],
  shared: ['types'],
  timeline: ['core', 'hooks', 'shared', 'types', 'widgets'],
  types: [],
  widgets: ['canvas', 'domain', 'hooks', 'inspector', 'shared', 'types'],
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
