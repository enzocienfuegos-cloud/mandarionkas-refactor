import { readScopedStorageItem, writeScopedStorageItem } from '../shared/browser/storage';
import type { WidgetInspectorPanelKey } from '../widgets/registry/widget-definition';

const STORAGE_KEY = 'smx.studio.inspector.accordion.v1';

type AccordionPrefs = Record<string, Partial<Record<WidgetInspectorPanelKey, boolean>>>;

function readPrefs(): AccordionPrefs {
  try {
    const raw = readScopedStorageItem(STORAGE_KEY, '');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as AccordionPrefs : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: AccordionPrefs): void {
  writeScopedStorageItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function getAccordionOpenState(
  widgetType: string,
  panelKey: WidgetInspectorPanelKey,
  fallback: boolean,
): boolean {
  const prefs = readPrefs();
  return prefs[widgetType]?.[panelKey] ?? fallback;
}

export function setAccordionOpenState(
  widgetType: string,
  panelKey: WidgetInspectorPanelKey,
  open: boolean,
): void {
  const prefs = readPrefs();
  writePrefs({
    ...prefs,
    [widgetType]: {
      ...prefs[widgetType],
      [panelKey]: open,
    },
  });
}
