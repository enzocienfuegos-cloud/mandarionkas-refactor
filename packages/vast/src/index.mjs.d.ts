/**
 * Type declarations for the VAST XML builder functions in index.mjs.
 * These are separate from the TypeScript client API in index.ts.
 */

export interface VastTagOptions {
  tagId: string;
  adTitle: string;
  mediaUrl: string;
  clickUrl: string;
  impressionUrl: string;
  trackingUrls?: Array<{ event: string; url: string }>;
  duration?: number;
  width?: number;
  height?: number;
  bitrate?: string;
  mimeType?: string;
}

export interface VastWrapperOptions {
  tagId: string;
  adTitle: string;
  wrapperUrl: string;
  impressionUrl?: string;
}

export declare function buildVastTag(opts: VastTagOptions): string;
export declare function buildVastWrapper(opts: VastWrapperOptions): string;
