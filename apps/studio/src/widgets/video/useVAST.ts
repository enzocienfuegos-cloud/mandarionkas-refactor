// apps/studio/src/widgets/video/useVAST.ts
//
// S48: Integrated OMIDSession lifecycle management.
// The hook creates an OMID session when the resolved ad has <AdVerifications>
// and manages start/finish/event relay automatically.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionTrigger, VASTConfig } from '@smx/contracts';
import { defaultBeaconFn, resolveVAST, selectBestMediaFile, VASTTracker } from '@smx/vast';
import type { MediaSelectorOptions, VASTAd, VASTCompanion, VASTMediaFile } from '@smx/vast';
import { createOMIDSession, type OMIDSession } from './OMIDSessionClient';

export type VASTStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'complete' | 'skipped' | 'error';

export interface VASTState {
  status: VASTStatus;
  ad: VASTAd | null;
  selectedMediaFile: VASTMediaFile | null;
  companions: VASTCompanion[];
  tracker: VASTTracker | null;
  errorMessage: string | null;
  skipCountdownSeconds: number;
  isSkippable: boolean;
}

export interface UseVASTOptions {
  vastConfig: VASTConfig | undefined;
  onActionTrigger: (trigger: ActionTrigger, metadata?: Record<string, unknown>) => void;
  mediaSelectorOptions?: Partial<MediaSelectorOptions>;
  apiBaseUrl?: string;
}

const EMPTY_STATE: VASTState = {
  status: 'idle',
  ad: null,
  selectedMediaFile: null,
  companions: [],
  tracker: null,
  errorMessage: null,
  skipCountdownSeconds: 0,
  isSkippable: false,
};

export function useVAST({
  vastConfig,
  onActionTrigger,
  mediaSelectorOptions = {},
  apiBaseUrl,
}: UseVASTOptions): VASTState & {
  onPlayerPlay: () => void;
  onPlayerPause: () => void;
  onPlayerTimeUpdate: (seconds: number) => void;
  onPlayerMute: () => void;
  onPlayerUnmute: () => void;
  onPlayerEnded: () => void;
  onSkipClick: () => void;
  onAdClick: () => void;
  onPlayerError: (code: number) => void;
} {
  const [state, setState] = useState<VASTState>(EMPTY_STATE);
  const trackerRef = useRef<VASTTracker | null>(null);
  // S48: OMID session ref
  const omidRef = useRef<OMIDSession | null>(null);
  const triggeredRef = useRef<Set<ActionTrigger>>(new Set());
  const onTriggerRef = useRef(onActionTrigger);
  const mediaSelectorOptionsRef = useRef(mediaSelectorOptions);
  onTriggerRef.current = onActionTrigger;
  mediaSelectorOptionsRef.current = mediaSelectorOptions;

  useEffect(() => {
    const config = vastConfig;
    if (!config || !config.tagUrl) {
      trackerRef.current = null;
      omidRef.current?.finish();
      omidRef.current = null;
      triggeredRef.current = new Set();
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    trackerRef.current = null;
    omidRef.current?.finish();
    omidRef.current = null;
    triggeredRef.current = new Set();
    setState((current) => ({ ...current, status: 'loading', errorMessage: null }));

    const base = apiBaseUrl ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : '') ?? '';
    const resolvedConfig = config;

    async function load(): Promise<void> {
      try {
        const result = await resolveVAST(resolvedConfig.tagUrl, {
          maxRedirects: resolvedConfig.maxRedirects ?? 5,
          timeoutMs: resolvedConfig.timeoutMs ?? 8000,
          fetchFn: async (url, signal) => {
            const res = await fetch(`${base}/v1/vast/resolve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagUrl: url }),
              signal,
            });
            if (!res.ok) throw new Error(`VAST proxy error: ${res.status}`);
            const json = await res.json() as { ok: boolean; xml: string };
            if (!json.ok) throw new Error('VAST proxy returned ok:false');
            return json.xml;
          },
        });

        if (cancelled) return;

        if (!result.ok) {
          setState((current) => ({ ...current, status: 'error', errorMessage: result.message }));
          onTriggerRef.current('vast-error', { code: result.errorCode, message: result.message });
          return;
        }

        const [ad] = result.ads;
        if (!ad?.linear) {
          setState((current) => ({ ...current, status: 'error', errorMessage: 'No linear ad in VAST response.' }));
          onTriggerRef.current('vast-error', { code: 303, message: 'No linear ad in VAST response.' });
          return;
        }

        if (typeof resolvedConfig.skipOffsetSecondsOverride === 'number') {
          ad.linear.skipOffset = resolvedConfig.skipOffsetSecondsOverride;
        }

        const selectedMediaFile = selectBestMediaFile(ad.linear.mediaFiles, mediaSelectorOptionsRef.current);
        if (!selectedMediaFile) {
          setState((current) => ({ ...current, status: 'error', errorMessage: 'No supported media file found.' }));
          onTriggerRef.current('vast-error', { code: 403, message: 'No supported media file found.' });
          return;
        }

        const tracker = new VASTTracker(ad, defaultBeaconFn);
        trackerRef.current = tracker;

        // S48: Create OMID session from the first <AdVerifications> entry (if any)
        const firstVerification = ad.adVerifications?.[0];
        if (firstVerification?.jsUrl) {
          omidRef.current = createOMIDSession(
            firstVerification.jsUrl,
            firstVerification.vendor,
            firstVerification.verificationParameters,
          );
        }

        setState({
          status: 'ready',
          ad,
          selectedMediaFile,
          companions: ad.companions,
          tracker,
          errorMessage: null,
          skipCountdownSeconds: tracker.skipCountdownSeconds(),
          isSkippable: tracker.isSkippable(),
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState((current) => ({ ...current, status: 'error', errorMessage: message }));
        onTriggerRef.current('vast-error', { code: 900, message });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, vastConfig]);

  const triggerOnce = useCallback((trigger: ActionTrigger, metadata?: Record<string, unknown>) => {
    if (triggeredRef.current.has(trigger)) return;
    triggeredRef.current.add(trigger);
    onTriggerRef.current(trigger, metadata);
  }, []);

  const onPlayerPlay = useCallback(() => {
    trackerRef.current?.onPlay();
    // S48: Start OMID session on first play
    if (omidRef.current && !omidRef.current.isActive) {
      omidRef.current.start();
    } else {
      omidRef.current?.start();
    }
    omidRef.current?.sendEvent('resume');
    setState((current) => ({ ...current, status: 'playing' }));
  }, []);

  const onPlayerPause = useCallback(() => {
    trackerRef.current?.onPause();
    omidRef.current?.sendEvent('pause');
    setState((current) => (current.status === 'playing' ? { ...current, status: 'ready' } : current));
  }, []);

  const onPlayerTimeUpdate = useCallback((seconds: number) => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    tracker.onTimeUpdate(seconds);

    if (seconds >= 2) triggerOnce('vast-impression');

    const duration = state.ad?.linear?.duration ?? 0;
    if (duration > 0) {
      const fraction = seconds / duration;
      if (fraction >= 0.25) { triggerOnce('vast-quartile-25'); omidRef.current?.sendEvent('firstQuartile'); }
      if (fraction >= 0.5)  { triggerOnce('vast-quartile-50'); omidRef.current?.sendEvent('midpoint'); }
      if (fraction >= 0.75) { triggerOnce('vast-quartile-75'); omidRef.current?.sendEvent('thirdQuartile'); }
    }

    setState((current) => ({ ...current, skipCountdownSeconds: tracker.skipCountdownSeconds() }));
  }, [state.ad, triggerOnce]);

  const onPlayerMute = useCallback(() => {
    trackerRef.current?.onMute();
    omidRef.current?.sendEvent('mute');
  }, []);

  const onPlayerUnmute = useCallback(() => {
    trackerRef.current?.onUnmute();
    omidRef.current?.sendEvent('unmute');
  }, []);

  const onPlayerEnded = useCallback(() => {
    const tracker = trackerRef.current;
    const duration = state.ad?.linear?.duration ?? 0;
    if (tracker && duration > 0) tracker.onTimeUpdate(duration);
    omidRef.current?.sendEvent('complete');
    omidRef.current?.finish();
    omidRef.current = null;
    triggerOnce('vast-complete');
    setState((current) => ({ ...current, status: 'complete', skipCountdownSeconds: 0 }));
  }, [state.ad, triggerOnce]);

  const onSkipClick = useCallback(() => {
    const tracker = trackerRef.current;
    if (!tracker || !tracker.isSkipAllowed()) return;
    tracker.onSkip();
    omidRef.current?.sendEvent('skip');
    omidRef.current?.finish();
    omidRef.current = null;
    triggerOnce('vast-skip');
    setState((current) => ({ ...current, status: 'skipped', skipCountdownSeconds: 0 }));
  }, [triggerOnce]);

  const onAdClick = useCallback(() => {
    trackerRef.current?.onClickThrough();
    omidRef.current?.sendEvent('click');
    onTriggerRef.current('vast-click');
  }, []);

  const onPlayerError = useCallback((code: number) => {
    trackerRef.current?.onError(code);
    omidRef.current?.sendEvent('error', { code });
    omidRef.current?.finish();
    omidRef.current = null;
    onTriggerRef.current('vast-error', { code });
    setState((current) => ({ ...current, status: 'error', errorMessage: `Player error ${code}` }));
  }, []);

  return {
    ...state,
    onPlayerPlay,
    onPlayerPause,
    onPlayerTimeUpdate,
    onPlayerMute,
    onPlayerUnmute,
    onPlayerEnded,
    onSkipClick,
    onAdClick,
    onPlayerError,
  };
}
