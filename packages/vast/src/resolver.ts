import type { VASTAd, VASTResolveOptions, VASTResolveResult } from './types.js';
import { VASTError, VASTErrors } from './errors.js';
import { parseVAST } from './parser/vast-parser.js';
import type { VASTWrapperDescriptor } from './parser/vast-parser.js';

async function defaultFetch(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal, mode: 'cors' });
  if (!response.ok) {
    throw VASTErrors.undefined(`HTTP ${response.status} fetching VAST tag: ${url}`);
  }
  return response.text();
}

function mergeWrapperIntoAd(ad: VASTAd, wrapper: Partial<VASTAd>): VASTAd {
  return {
    ...ad,
    impressionUrls: [...(wrapper.impressionUrls ?? []), ...ad.impressionUrls],
    errorUrls: [...(wrapper.errorUrls ?? []), ...ad.errorUrls],
    companions: [...(wrapper.companions ?? []), ...ad.companions],
    extensions: [...(wrapper.extensions ?? []), ...ad.extensions],
    id: ad.id ?? wrapper.id,
    adSystem: ad.adSystem ?? wrapper.adSystem,
  };
}

function mergeLinearTracking(ad: VASTAd, _wrapperPartial: Partial<VASTAd>): VASTAd {
  if (!ad.linear) return ad;
  return ad;
}

export async function resolveVAST(
  tagUrl: string,
  options: VASTResolveOptions = {},
): Promise<VASTResolveResult> {
  const {
    maxRedirects = 5,
    timeoutMs = 8000,
    fetchFn = defaultFetch,
    onWrapperResolved,
  } = options;

  let currentUrl = tagUrl;
  let requestCount = 0;
  const wrapperStack: Partial<VASTAd>[] = [];

  while (requestCount <= maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let rawXml: string;
    try {
      rawXml = await fetchFn(currentUrl, controller.signal);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, errorCode: 301, message: VASTErrors.wrapperTimeout(currentUrl).message, requestCount };
      }
      return { ok: false, errorCode: 900, message: `Failed to fetch VAST tag: ${String(error)}`, requestCount };
    } finally {
      clearTimeout(timeoutId);
    }

    requestCount += 1;

    let parsed;
    try {
      parsed = parseVAST(rawXml);
    } catch (error) {
      const code = error instanceof VASTError ? error.code : 100;
      return { ok: false, errorCode: code, message: String(error), requestCount };
    }

    if (parsed.length === 0) {
      return { ok: false, errorCode: 303, message: 'No ads in VAST response', requestCount };
    }

    const inlineResults = parsed.filter((item) => item.kind === 'inline');
    const wrapperResults = parsed.filter((item): item is VASTWrapperDescriptor => item.kind === 'wrapper');

    if (inlineResults.length > 0) {
      const ads = inlineResults.map(({ ad }) => {
        let resolved = ad;
        for (const partial of [...wrapperStack].reverse()) {
          resolved = mergeWrapperIntoAd(resolved, partial);
          resolved = mergeLinearTracking(resolved, partial);
        }
        return resolved;
      });
      return { ok: true, ads, requestCount };
    }

    const wrapper = wrapperResults[0];
    if (!wrapper.followAdditionalWrappers && requestCount > 1) {
      return { ok: false, errorCode: 302, message: 'Wrapper disallows additional redirects', requestCount };
    }
    if (requestCount >= maxRedirects) {
      return { ok: false, errorCode: 302, message: VASTErrors.wrapperLimitReached(maxRedirects).message, requestCount };
    }

    wrapperStack.push(wrapper.partial);
    onWrapperResolved?.(requestCount, currentUrl);
    currentUrl = wrapper.vastAdTagUri;
  }

  return { ok: false, errorCode: 302, message: VASTErrors.wrapperLimitReached(maxRedirects).message, requestCount };
}
