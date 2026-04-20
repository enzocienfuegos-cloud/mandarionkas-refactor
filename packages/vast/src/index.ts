export type {
  VASTAd,
  VASTLinear,
  VASTMediaFile,
  VASTMediaFileDelivery,
  VASTMediaFileType,
  VASTCompanion,
  VASTCompanionResource,
  VASTIcon,
  VASTInteractiveCreativeFile,
  VASTExtension,
  VASTTrackingEvent,
  VASTErrorCode,
  VASTResolveResult,
  VASTResolveSuccess,
  VASTResolveError,
  VASTResolveOptions,
} from './types.js';

export { resolveVAST } from './resolver.js';
export { parseVAST } from './parser/vast-parser.js';
export type { ParsedAdResult, VASTWrapperDescriptor } from './parser/vast-parser.js';
export { VASTTracker, defaultBeaconFn } from './tracking/tracker.js';
export type { BeaconFn } from './tracking/tracker.js';
export { selectBestMediaFile, detectHLSSupport } from './media-selector.js';
export type { MediaSelectorOptions } from './media-selector.js';
export { VASTError, VASTErrors } from './errors.js';
