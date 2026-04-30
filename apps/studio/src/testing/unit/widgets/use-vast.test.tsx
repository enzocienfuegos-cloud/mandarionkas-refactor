import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionTrigger, VASTConfig } from '@smx/contracts';
import * as vastModule from '@smx/vast';
import { useVAST } from '../../../widgets/video/useVAST';

type HookState = ReturnType<typeof useVAST>;

function createAd() {
  return {
    id: 'vast-ad-1',
    impressionUrls: [],
    errorUrls: [],
    extensions: [],
    companions: [{ id: 'companion-1', width: 300, height: 250 }],
    linear: {
      duration: 20,
      skipOffset: 5,
      mediaFiles: [
        {
          id: 'media-1',
          src: 'https://cdn.example.com/video.mp4',
          type: 'video/mp4',
          delivery: 'progressive',
          width: 1080,
          height: 1920,
        },
      ],
      interactiveCreativeFiles: [],
      clickTrackingUrls: [],
      customClickUrls: [],
      trackingEvents: {},
      icons: [],
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForCondition(predicate: () => boolean, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await act(async () => {
      await flush();
    });
  }
  throw new Error('Condition was not met in time.');
}

function Harness({
  config,
  onActionTrigger,
  onChange,
}: {
  config?: VASTConfig;
  onActionTrigger: (trigger: ActionTrigger, metadata?: Record<string, unknown>) => void;
  onChange: (value: HookState) => void;
}) {
  const state = useVAST({
    vastConfig: config,
    onActionTrigger,
    apiBaseUrl: 'https://api.example.com',
  });

  React.useEffect(() => {
    onChange(state);
  }, [onChange, state]);

  return null;
}

async function renderHarness({
  config,
  onActionTrigger = vi.fn(),
}: {
  config?: VASTConfig;
  onActionTrigger?: (trigger: ActionTrigger, metadata?: Record<string, unknown>) => void;
}) {
  let latest: HookState | null = null;
  let root: ReactTestRenderer;

  await act(async () => {
    root = create(
      <Harness
        config={config}
        onActionTrigger={onActionTrigger}
        onChange={(value) => {
          latest = value;
        }}
      />,
    );
    await flush();
  });

  return {
    get state() {
      if (!latest) throw new Error('Hook state not captured.');
      return latest;
    },
    onActionTrigger,
    root: root!,
  };
}

describe('useVAST', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stays idle when no VAST config is provided', async () => {
    const onActionTrigger = vi.fn();
    const harness = await renderHarness({ config: undefined, onActionTrigger });

    expect(harness.state.status).toBe('idle');
    expect(harness.state.ad).toBeNull();
    expect(onActionTrigger).not.toHaveBeenCalled();
  });

  it('loads VAST, selects media and becomes ready', async () => {
    const ad = createAd();
    const resolveSpy = vi.spyOn(vastModule, 'resolveVAST').mockResolvedValueOnce({ ok: true, ads: [ad] } as any);
    const selectSpy = vi.spyOn(vastModule, 'selectBestMediaFile').mockReturnValueOnce(ad.linear.mediaFiles[0] as any);

    const harness = await renderHarness({
      config: { tagUrl: 'https://ads.example.com/vast.xml', timeoutMs: 4000, maxRedirects: 3 },
    });

    await waitForCondition(() => harness.state.status === 'ready');

    expect(resolveSpy).toHaveBeenCalledWith(
      'https://ads.example.com/vast.xml',
      expect.objectContaining({
        maxRedirects: 3,
        timeoutMs: 4000,
        fetchFn: expect.any(Function),
      }),
    );
    expect(selectSpy).toHaveBeenCalledWith(ad.linear.mediaFiles, {});
    expect(harness.state.status).toBe('ready');
    expect(harness.state.selectedMediaFile).toEqual(ad.linear.mediaFiles[0]);
    expect(harness.state.companions).toEqual(ad.companions);
    expect(harness.state.isSkippable).toBe(true);
    expect(harness.state.skipCountdownSeconds).toBe(5);
  });

  it('emits impression and quartiles only once as playback advances', async () => {
    const ad = createAd();
    const onActionTrigger = vi.fn();
    vi.spyOn(vastModule, 'resolveVAST').mockResolvedValueOnce({ ok: true, ads: [ad] } as any);
    vi.spyOn(vastModule, 'selectBestMediaFile').mockReturnValueOnce(ad.linear.mediaFiles[0] as any);

    const harness = await renderHarness({
      config: { tagUrl: 'https://ads.example.com/vast.xml' },
      onActionTrigger,
    });

    await waitForCondition(() => harness.state.status === 'ready');

    await act(async () => {
      harness.state.onPlayerTimeUpdate(6);
      harness.state.onPlayerTimeUpdate(11);
      harness.state.onPlayerTimeUpdate(16);
      harness.state.onPlayerTimeUpdate(18);
      await flush();
    });

    expect(onActionTrigger.mock.calls.filter(([trigger]) => trigger === 'vast-impression')).toHaveLength(1);
    expect(onActionTrigger.mock.calls.filter(([trigger]) => trigger === 'vast-quartile-25')).toHaveLength(1);
    expect(onActionTrigger.mock.calls.filter(([trigger]) => trigger === 'vast-quartile-50')).toHaveLength(1);
    expect(onActionTrigger.mock.calls.filter(([trigger]) => trigger === 'vast-quartile-75')).toHaveLength(1);
    expect(harness.state.skipCountdownSeconds).toBe(0);
  });

  it('only skips once the tracker allows it', async () => {
    const ad = createAd();
    const onActionTrigger = vi.fn();
    vi.spyOn(vastModule, 'resolveVAST').mockResolvedValueOnce({ ok: true, ads: [ad] } as any);
    vi.spyOn(vastModule, 'selectBestMediaFile').mockReturnValueOnce(ad.linear.mediaFiles[0] as any);

    const harness = await renderHarness({
      config: { tagUrl: 'https://ads.example.com/vast.xml' },
      onActionTrigger,
    });

    await waitForCondition(() => harness.state.status === 'ready');

    await act(async () => {
      harness.state.onSkipClick();
      await flush();
    });

    expect(onActionTrigger).not.toHaveBeenCalledWith('vast-skip');
    expect(harness.state.status).toBe('ready');

    await act(async () => {
      harness.state.onPlayerTimeUpdate(5);
      harness.state.onSkipClick();
      await flush();
    });

    expect(onActionTrigger).toHaveBeenCalledWith('vast-skip', undefined);
    expect(harness.state.status).toBe('skipped');
  });

  it('surfaces resolver failures as vast-error', async () => {
    const onActionTrigger = vi.fn();
    vi.spyOn(vastModule, 'resolveVAST').mockResolvedValueOnce({
      ok: false,
      errorCode: 301,
      message: 'Wrapper limit exceeded',
    } as any);

    const harness = await renderHarness({
      config: { tagUrl: 'https://ads.example.com/bad-vast.xml' },
      onActionTrigger,
    });

    await waitForCondition(() => harness.state.status === 'error');

    expect(harness.state.status).toBe('error');
    expect(harness.state.errorMessage).toBe('Wrapper limit exceeded');
    expect(onActionTrigger).toHaveBeenCalledWith('vast-error', {
      code: 301,
      message: 'Wrapper limit exceeded',
    });
  });
});
