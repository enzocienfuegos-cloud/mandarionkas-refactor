import { useEffect } from 'react';

export type ShortcutBinding = {
  combo: string;
  action: (event: KeyboardEvent) => void;
  enabled?: () => boolean;
  allowRepeat?: boolean;
};

function normalizeShortcutKey(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized === 'esc') return 'escape';
  if (normalized === 'del') return 'delete';
  if (normalized === 'spacebar' || normalized === ' ') return 'space';
  return normalized;
}

function isImplicitShiftCombo(key: string): boolean {
  return key === '?' || key === '+';
}

function matchesShortcutKey(event: KeyboardEvent, key: string): boolean {
  const normalizedEventKey = normalizeShortcutKey(event.key);
  if (key === '=') {
    return normalizedEventKey === '=' || normalizedEventKey === '+';
  }
  if (key === 'space') {
    return event.code === 'Space' || normalizedEventKey === 'space';
  }
  return normalizedEventKey === key;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  const tagName = node?.tagName?.toLowerCase();
  const withinDialog = Boolean(node?.closest?.('[role="dialog"]'));
  return withinDialog || Boolean(node?.isContentEditable) || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function matchesShortcutCombo(event: KeyboardEvent, combo: string): boolean {
  const tokens = combo.toLowerCase().split('+').filter(Boolean);
  if (!tokens.length) return false;
  const key = tokens[tokens.length - 1];
  const modifiers = new Set(tokens.slice(0, -1));

  const expectsCmd = modifiers.has('cmd');
  const expectsCtrl = modifiers.has('ctrl');
  const expectsShift = modifiers.has('shift');
  const expectsAlt = modifiers.has('alt');

  const cmdPressed = event.metaKey || event.ctrlKey;
  if (expectsCmd !== cmdPressed) return false;
  if (expectsCtrl && !event.ctrlKey) return false;
  if (!expectsCtrl && event.ctrlKey && !expectsCmd) return false;
  if (expectsAlt !== event.altKey) return false;
  if (!matchesShortcutKey(event, key)) return false;

  const implicitShift = isImplicitShiftCombo(key) || (key === '=' && normalizeShortcutKey(event.key) === '+');
  if (expectsShift !== event.shiftKey && !(implicitShift && event.shiftKey)) return false;
  if (!expectsShift && event.shiftKey && !implicitShift) return false;

  return true;
}

export function detectMacLikePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  const userAgent = navigator.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform) || /mac|iphone|ipad|ipod/i.test(userAgent);
}

export function formatShortcutCombo(combo: string, preferMac = detectMacLikePlatform()): string {
  return formatShortcutTokens(combo, preferMac).join(preferMac ? '' : '+');
}

export function formatShortcutTokens(combo: string, preferMac = detectMacLikePlatform()): string[] {
  const tokens = combo.toLowerCase().split('+').filter(Boolean);
  return tokens.map((token) => {
    if (preferMac) {
      switch (token) {
        case 'cmd': return '⌘';
        case 'ctrl': return '⌃';
        case 'shift': return '⇧';
        case 'alt': return '⌥';
        case 'arrowup': return '↑';
        case 'arrowdown': return '↓';
        case 'arrowleft': return '←';
        case 'arrowright': return '→';
        case 'delete':
        case 'backspace':
          return '⌫';
        case 'tab': return '⇥';
        case 'space': return 'Space';
        default: return token.toUpperCase();
      }
    }

    switch (token) {
      case 'cmd': return 'Ctrl';
      case 'ctrl': return 'Ctrl';
      case 'shift': return 'Shift';
      case 'alt': return 'Alt';
      case 'arrowup': return 'Up';
      case 'arrowdown': return 'Down';
      case 'arrowleft': return 'Left';
      case 'arrowright': return 'Right';
      case 'delete':
      case 'backspace':
        return 'Backspace';
      case 'tab': return 'Tab';
      case 'space': return 'Space';
      default: return token.length === 1 ? token.toUpperCase() : token;
    }
  });
}

export function useKeyboardShortcuts(specs: ShortcutBinding[]): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      const match = specs.find((spec) => matchesShortcutCombo(event, spec.combo) && (spec.enabled?.() ?? true));
      if (!match) return;
      if (event.repeat && !match.allowRepeat) return;
      event.preventDefault();
      match.action(event);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [specs]);
}
