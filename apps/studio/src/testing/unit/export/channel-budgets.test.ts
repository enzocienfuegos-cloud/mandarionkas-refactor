import { describe, expect, it } from 'vitest';
import { CHANNEL_BUDGETS, checkChannelBudget } from '../../../export/channel-budgets';

describe('channel budgets', () => {
  it('fails MRAID overruns as hard errors', () => {
    const result = checkChannelBudget('mraid', {
      zipBytes: 1_500_000,
      initialLoadBytes: 320_000,
      runtimeJsBytes: 120_000,
      assetCount: 12,
    });

    expect(result.pass).toBe(false);
    expect(result.overruns.map((item) => item.field)).toEqual(['zipBytes', 'initialLoadBytes']);
    expect(result.overruns.every((item) => item.severity === 'error')).toBe(true);
  });

  it('passes compliant MRAID packages', () => {
    const result = checkChannelBudget('mraid', {
      zipBytes: 800_000,
      initialLoadBytes: 250_000,
      runtimeJsBytes: 120_000,
      assetCount: 12,
    });

    expect(result.pass).toBe(true);
    expect(result.overruns).toEqual([]);
  });

  it('reports display overruns as warnings without blocking', () => {
    const result = checkChannelBudget('google-display', {
      zipBytes: 3_000_000,
      initialLoadBytes: 520_000,
      runtimeJsBytes: 210_000,
      assetCount: 40,
    });

    expect(result.pass).toBe(true);
    expect(result.overruns.length).toBe(3);
    expect(result.overruns.every((item) => item.severity === 'warning')).toBe(true);
  });

  it('passes vertical playable-style budgets', () => {
    const result = checkChannelBudget('tiktok-vertical', {
      zipBytes: 4_000_000,
      initialLoadBytes: 900_000,
      runtimeJsBytes: 250_000,
      assetCount: 40,
    });

    expect(result.pass).toBe(true);
    expect(result.overruns).toEqual([]);
  });

  it('fails SIMID packages that exceed the XML budget', () => {
    const result = checkChannelBudget('vast-simid', {
      zipBytes: 500_000,
      initialLoadBytes: 90_000,
      runtimeJsBytes: 70_000,
      assetCount: 2,
    });

    expect(result.pass).toBe(false);
    expect(result.overruns.map((item) => item.field)).toEqual(['zipBytes']);
  });

  it('reports asset count overruns independently', () => {
    const result = checkChannelBudget('gam-html5', {
      zipBytes: 200_000,
      initialLoadBytes: 120_000,
      runtimeJsBytes: 20_000,
      assetCount: CHANNEL_BUDGETS['gam-html5'].maxAssetCount + 1,
    });

    expect(result.overruns).toHaveLength(1);
    expect(result.overruns[0]).toMatchObject({ field: 'assetCount', severity: 'error' });
  });

  it('treats exact limits as passing', () => {
    const budget = CHANNEL_BUDGETS['mraid'];
    const result = checkChannelBudget('mraid', {
      zipBytes: budget.maxZipBytes,
      initialLoadBytes: budget.maxInitialLoadBytes,
      runtimeJsBytes: budget.maxRuntimeJsBytes,
      assetCount: budget.maxAssetCount,
    });

    expect(result.pass).toBe(true);
    expect(result.overruns).toEqual([]);
  });
});
