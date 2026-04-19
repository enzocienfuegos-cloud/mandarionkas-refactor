import { describe, expect, it } from 'vitest';
import { layerRules } from './layer-rules';
import { importedSpecifiers, readSourceFiles, sourceLayer, targetLayer } from './resolve-imports';

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

describe('architecture guardrails', () => {
  const files = readSourceFiles();

  it('keeps UI layers off store singletons, platform store, and raw persistence', () => {
    const uiPrefixes = ['src/app/', 'src/canvas/', 'src/inspector/', 'src/timeline/', 'src/widgets/'];
    const forbiddenImports = [
      /(?:^|\/)assets\/repository(?:\.ts)?$/,
      /(?:^|\/)projects\/repository(?:\.ts)?$/,
      /(?:^|\/)persistence\/local\/storage(?:\.ts)?$/,
      /(?:^|\/)platform\/store(?:\.ts)?$/,
      /(?:^|\/)core\/store\/studio-store(?:\.ts)?$/,
      /^@platform\/store(?:\/.*)?$/,
      /^@core\/store\/studio-store(?:\/.*)?$/,
    ];
    const allowlistedFiles = new Set(['src/hooks/use-studio-actions.ts', 'src/core/store/use-studio-store.ts']);
    const offenders = files.flatMap((file) => {
      if (!uiPrefixes.some((prefix) => file.relativePath.startsWith(prefix))) return [];
      if (allowlistedFiles.has(file.relativePath)) return [];
      return importedSpecifiers(file.content)
        .filter((specifier) => matchesAny(specifier, forbiddenImports))
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps repositories off platform store singletons', () => {
    const forbiddenImports = [/(?:^|\/)platform\/store(?:\.ts)?$/, /^@platform\/store(?:\/.*)?$/];
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('src/repositories/')) return [];
      return importedSpecifiers(file.content)
        .filter((specifier) => matchesAny(specifier, forbiddenImports))
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps raw browser storage access inside approved adapters', () => {
    const allowedFiles = new Set([
      'src/shared/browser/storage.ts',
      'src/integrations/fetch-cache.ts',
      'src/testing/setup.ts',
      // runtime-script.ts generates JavaScript that runs inside exported HTML banners —
      // localStorage usage there is intentional runtime code, not application storage access.
      'src/export/runtime-script.ts',
      // dynamic-map and weather-conditions cache API responses in localStorage for
      // offline/preview resilience inside the studio canvas renderer.
      'src/widgets/modules/dynamic-map.shared.ts',
      'src/widgets/modules/weather-conditions.shared.ts',
    ]);
    const offenders = files.flatMap((file) => {
      if (allowedFiles.has(file.relativePath)) return [];
      const hits = file.content.match(/\b(localStorage|sessionStorage)\b/g) ?? [];
      return hits.length ? [`${file.relativePath} uses ${[...new Set(hits)].join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('keeps raw fetch calls inside approved network adapters', () => {
    const allowedFiles = new Set([
      'src/shared/net/http-json.ts',
      'src/integrations/fetch-cache.ts',
      // runtime-script.ts generates JavaScript injected into exported HTML banners —
      // fetch() there is runtime code for the banner, not an application network call.
      'src/export/runtime-script.ts',
    ]);
    const offenders = files.flatMap((file) => {
      if (allowedFiles.has(file.relativePath)) return [];
      return /\bfetch\(/.test(file.content) ? [`${file.relativePath} uses fetch()`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('keeps domain independent from export, app, platform, and repository layers', () => {
    const forbiddenImports = [/(?:^|\/)export\//, /(?:^|\/)app\//, /(?:^|\/)platform\//, /(?:^|\/)repositories\//, /^@export\//, /^@app\//, /^@platform\//, /^@repositories\//];
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('src/domain/')) return [];
      return importedSpecifiers(file.content)
        .filter((specifier) => matchesAny(specifier, forbiddenImports))
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps imports within declared layer boundaries', () => {
    const allowedSelfImports = new Set(['src/App.tsx', 'src/main.tsx']);
    const offenders = files.flatMap((file) => {
      if (allowedSelfImports.has(file.relativePath)) return [];
      const fromLayer = sourceLayer(file.relativePath);
      if (!fromLayer) return [];
      const allowedTargets = new Set([fromLayer, ...layerRules[fromLayer]]);
      return importedSpecifiers(file.content)
        .map((specifier) => ({ specifier, toLayer: targetLayer(file.relativePath, specifier) }))
        .filter((entry) => entry.toLayer && !allowedTargets.has(entry.toLayer))
        .map((entry) => `${file.relativePath} (${fromLayer}) -> ${entry.specifier} (${entry.toLayer})`);
    });
    expect(offenders).toEqual([]);
  });
});
