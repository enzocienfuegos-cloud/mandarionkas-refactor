/**
 * @smx/vast — unified VAST package
 *
 * Generation API (server-side): buildVastTag, buildVastWrapper
 * Client API (browser-side):    resolveVAST, parseVAST, selectBestMediaFile, VASTTracker, …
 */

// ── Generation API (re-exported from the JS builder) ──────────────────────────
export { buildVastTag, buildVastWrapper } from './index.mjs';

// ── Client types ───────────────────────────────────────────────────────────────
export type {
  VASTAd,
  VASTCompanion,
  VASTCompanionResource,
  VASTErrorCode,
  VASTExtension,
  VASTIcon,
  VASTInteractiveCreativeFile,
  VASTLinear,
  VASTMediaFile,
  VASTMediaFileDelivery,
  VASTMediaFileType,
  VASTResolveError,
  VASTResolveOptions,
  VASTResolveResult,
  VASTResolveSuccess,
  VASTTrackingEvent,
} from './types.js';

// ── Errors ─────────────────────────────────────────────────────────────────────
export { VASTError, VASTErrors } from './errors.js';

// ── Resolver ───────────────────────────────────────────────────────────────────
export { resolveVAST } from './resolver.js';

// ── Parser ─────────────────────────────────────────────────────────────────────
export { parseVAST } from './parser/vast-parser.js';

// ── Media selector ─────────────────────────────────────────────────────────────
export { selectBestMediaFile, detectHLSSupport } from './media-selector.js';
export type { MediaSelectorOptions } from './media-selector.js';

// ── Tracker ────────────────────────────────────────────────────────────────────
export { VASTTracker, defaultBeaconFn } from './tracking/tracker.js';
export type { BeaconFn } from './tracking/tracker.js';
