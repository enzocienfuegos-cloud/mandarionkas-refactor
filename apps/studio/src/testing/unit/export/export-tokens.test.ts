import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportAlpha, exportColor, exportTokens } from '../../../export/export-tokens';

function readThemeVariable(name: string): string | undefined {
  const theme = readFileSync(new URL('../../../shared/theme-core.css', import.meta.url), 'utf8');
  return theme.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]+)`, 'm'))?.[1];
}

describe('export tokens', () => {
  it('matches theme-core.css for canonical shell colors', () => {
    expect(exportTokens.bg).toBe(readThemeVariable('bg'));
    expect(exportTokens.panel).toBe(readThemeVariable('panel'));
    expect(exportTokens.text).toBe(readThemeVariable('text'));
    expect(exportTokens.muted).toBe(readThemeVariable('muted'));
    expect(exportTokens.accent).toBe(readThemeVariable('accent'));
    expect(exportTokens.accentSoft).toBe(readThemeVariable('accent-soft'));
    expect(exportTokens.success).toBe(readThemeVariable('accent-2'));
    expect(exportTokens.danger).toBe(readThemeVariable('danger'));
    expect(exportTokens.warning).toBe(readThemeVariable('warning'));
    expect(exportTokens.white).toBe(readThemeVariable('white'));
    expect(exportTokens.ink).toBe(readThemeVariable('ink-strong'));
  });

  it('exposes helpers for direct export usage', () => {
    expect(exportColor('panel')).toBe(exportTokens.panel);
    expect(exportAlpha('accent', 0.12)).toBe('rgba(245,165,36,0.12)');
  });
});
