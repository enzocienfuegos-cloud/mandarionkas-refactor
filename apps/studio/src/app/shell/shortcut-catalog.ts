export type ShortcutCategory = 'edit' | 'navigation' | 'view' | 'file' | 'help';

export type ShortcutDefinition = {
  combo: string;
  description: string;
  category: ShortcutCategory;
};

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  edit: 'Edit',
  navigation: 'Navigation',
  view: 'View',
  file: 'File',
  help: 'Help',
};

export const SHORTCUT_CATEGORY_ORDER: ShortcutCategory[] = ['edit', 'navigation', 'view', 'file', 'help'];

export const SHORTCUT_CATALOG: ShortcutDefinition[] = [
  { combo: 'cmd+z', description: 'Undo', category: 'edit' },
  { combo: 'cmd+shift+z', description: 'Redo', category: 'edit' },
  { combo: 'cmd+c', description: 'Copy selection', category: 'edit' },
  { combo: 'cmd+v', description: 'Paste selection', category: 'edit' },
  { combo: 'delete', description: 'Delete selection', category: 'edit' },
  { combo: 'cmd+d', description: 'Duplicate selection', category: 'edit' },
  { combo: 'cmd+g', description: 'Group selection', category: 'edit' },
  { combo: 'cmd+shift+g', description: 'Ungroup selection', category: 'edit' },
  { combo: '[', description: 'Send backward', category: 'edit' },
  { combo: ']', description: 'Bring forward', category: 'edit' },
  { combo: 'arrowup', description: 'Nudge up 1px', category: 'edit' },
  { combo: 'arrowdown', description: 'Nudge down 1px', category: 'edit' },
  { combo: 'arrowleft', description: 'Nudge left 1px', category: 'edit' },
  { combo: 'arrowright', description: 'Nudge right 1px', category: 'edit' },
  { combo: 'shift+arrowup', description: 'Nudge up 10px', category: 'edit' },
  { combo: 'shift+arrowdown', description: 'Nudge down 10px', category: 'edit' },
  { combo: 'shift+arrowleft', description: 'Nudge left 10px', category: 'edit' },
  { combo: 'shift+arrowright', description: 'Nudge right 10px', category: 'edit' },
  { combo: 'tab', description: 'Cycle selection forward', category: 'navigation' },
  { combo: 'shift+tab', description: 'Cycle selection backward', category: 'navigation' },
  { combo: 'space', description: 'Hold to pan the canvas', category: 'navigation' },
  { combo: 'w', description: 'Toggle wireframe', category: 'view' },
  { combo: 'cmd+0', description: 'Fit to viewport', category: 'view' },
  { combo: 'cmd+=', description: 'Zoom in', category: 'view' },
  { combo: 'cmd+-', description: 'Zoom out', category: 'view' },
  { combo: 'cmd+s', description: 'Save project', category: 'file' },
  { combo: 'cmd+e', description: 'Export current channel', category: 'file' },
  { combo: '?', description: 'Show keyboard shortcuts', category: 'help' },
];

export function groupShortcutCatalogByCategory(catalog: ShortcutDefinition[] = SHORTCUT_CATALOG): Record<ShortcutCategory, ShortcutDefinition[]> {
  return SHORTCUT_CATEGORY_ORDER.reduce((groups, category) => ({
    ...groups,
    [category]: catalog.filter((entry) => entry.category === category),
  }), {} as Record<ShortcutCategory, ShortcutDefinition[]>);
}

