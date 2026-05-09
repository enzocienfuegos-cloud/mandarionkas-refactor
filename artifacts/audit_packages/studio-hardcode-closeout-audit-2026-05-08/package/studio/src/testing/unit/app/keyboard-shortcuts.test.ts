import { describe, expect, it } from 'vitest';
import { SHORTCUT_CATEGORY_ORDER, SHORTCUT_CATALOG, groupShortcutCatalogByCategory } from '../../../app/shell/shortcut-catalog';
import { formatShortcutCombo, isEditableShortcutTarget, matchesShortcutCombo } from '../../../app/shell/use-keyboard-shortcuts';

function createKeyboardEvent(input: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: input.key,
    code: input.code ?? '',
    metaKey: input.metaKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    shiftKey: input.shiftKey ?? false,
    altKey: input.altKey ?? false,
  } as KeyboardEvent;
}

describe('keyboard shortcut helpers', () => {
  it('matches command shortcuts across meta and ctrl keys', () => {
    expect(matchesShortcutCombo(createKeyboardEvent({ key: 'z', metaKey: true }), 'cmd+z')).toBe(true);
    expect(matchesShortcutCombo(createKeyboardEvent({ key: 'z', ctrlKey: true }), 'cmd+z')).toBe(true);
    expect(matchesShortcutCombo(createKeyboardEvent({ key: 'z' }), 'cmd+z')).toBe(false);
  });

  it('matches question mark and zoom-plus combos correctly', () => {
    expect(matchesShortcutCombo(createKeyboardEvent({ key: '?', shiftKey: true }), '?')).toBe(true);
    expect(matchesShortcutCombo(createKeyboardEvent({ key: '+', metaKey: true, shiftKey: true }), 'cmd+=')).toBe(true);
    expect(matchesShortcutCombo(createKeyboardEvent({ key: '=', metaKey: true }), 'cmd+=')).toBe(true);
  });

  it('formats combos for mac and non-mac displays', () => {
    expect(formatShortcutCombo('cmd+shift+z', true)).toBe('⌘⇧Z');
    expect(formatShortcutCombo('cmd+shift+z', false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcutCombo('arrowleft', false)).toBe('Left');
  });

  it('groups the shortcut catalog by category in a stable order', () => {
    const groups = groupShortcutCatalogByCategory();
    expect(SHORTCUT_CATEGORY_ORDER.every((category) => Array.isArray(groups[category]))).toBe(true);
    expect(groups.edit.some((entry) => entry.combo === 'cmd+z')).toBe(true);
    expect(groups.help).toEqual(SHORTCUT_CATALOG.filter((entry) => entry.category === 'help'));
  });

  it('treats editable fields and dialogs as shortcut exclusions', () => {
    expect(isEditableShortcutTarget({
      tagName: 'INPUT',
      isContentEditable: false,
      closest: () => null,
    } as unknown as HTMLElement)).toBe(true);

    expect(isEditableShortcutTarget({
      tagName: 'DIV',
      isContentEditable: false,
      closest: (selector: string) => selector === '[role="dialog"]' ? {} : null,
    } as unknown as HTMLElement)).toBe(true);

    expect(isEditableShortcutTarget({
      tagName: 'BUTTON',
      isContentEditable: false,
      closest: () => null,
    } as unknown as HTMLElement)).toBe(false);
  });
});
