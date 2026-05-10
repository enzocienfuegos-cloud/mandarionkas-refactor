import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportAlpha, exportColor, exportTokens } from '../../../export/export-tokens';

function readThemeVariables(): Map<string, string> {
  const theme = readFileSync(new URL('../../../shared/theme-core.css', import.meta.url), 'utf8');
  const variables = new Map<string, string>();
  const matches = theme.matchAll(/--([\w-]+):\s*([^;]+);/gm);
  for (const [, name, value] of matches) {
    variables.set(name, value.trim());
  }
  return variables;
}

function readThemeVariable(name: string): string | undefined {
  const variables = readThemeVariables();
  const value = variables.get(name);
  if (!value) return undefined;
  const variableReference = value.match(/^var\(--([\w-]+)\)$/)?.[1];
  return variableReference ? variables.get(variableReference) : value;
}

describe('export tokens', () => {
  it('matches theme-core.css for canonical shell colors', () => {
    expect(exportTokens.bg).toBe(readThemeVariable('bg'));
    expect(exportTokens.panel).toBe(readThemeVariable('panel'));
    expect(exportTokens.text).toBe(readThemeVariable('text'));
    expect(exportTokens.muted).toBe(readThemeVariable('muted'));
    expect(exportTokens.accent).toBe(readThemeVariable('accent'));
    expect(exportTokens.accentSoft).toBe(readThemeVariable('accent-soft'));
    expect(exportTokens.success).toBe(readThemeVariable('success'));
    expect(exportTokens.danger).toBe(readThemeVariable('danger'));
    expect(exportTokens.warning).toBe(readThemeVariable('warning'));
    expect(exportTokens.white).toBe(readThemeVariable('white'));
    expect(exportTokens.ink).toBe(readThemeVariable('ink-strong'));
  });

  it('exposes helpers for direct export usage', () => {
    expect(exportColor('panel')).toBe(exportTokens.panel);
    expect(exportAlpha('accent', 0.12)).toBe('rgba(255,47,214,0.12)');
  });
});
