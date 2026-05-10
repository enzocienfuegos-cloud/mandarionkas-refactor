import type { VASTErrorCode } from './types.js';

export class VASTError extends Error {
  readonly code: VASTErrorCode;

  constructor(code: VASTErrorCode, message: string) {
    super(message);
    this.name = 'VASTError';
    this.code = code;
  }
}

export const VASTErrors = {
  parseError: (detail: string) => new VASTError(100, `VAST XML parse error: ${detail}`),
  schemaError: (detail: string) => new VASTError(101, `VAST schema validation error: ${detail}`),
  versionNotSupported: (version: string) => new VASTError(102, `VAST version not supported: ${version}`),
  wrapperTimeout: (url: string) => new VASTError(301, `Wrapper request timed out: ${url}`),
  wrapperLimitReached: (limit: number) => new VASTError(302, `Wrapper redirect limit reached (max ${limit})`),
  noAds: () => new VASTError(303, 'VAST response contained no ads'),
  noSupportedMediaFile: () => new VASTError(403, 'No supported media file found in VAST response'),
  undefined: (detail: string) => new VASTError(900, `Undefined VAST error: ${detail}`),
} as const;
