// packages/vast/src/types.ts
// S48: Added VASTAdVerification type and adVerifications field to VASTAd.

export type VASTTrackingEvent =
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'impression'
  | 'click'
  | 'clickTracking'
  | 'skip'
  | 'close'
  | 'closeLinear'
  | 'pause'
  | 'resume'
  | 'rewind'
  | 'mute'
  | 'unmute'
  | 'fullscreen'
  | 'exitFullscreen'
  | 'expand'
  | 'collapse'
  | 'acceptInvitation'
  | 'creativeView'
  | 'viewable-impression'
  | 'notViewable-impression'
  | 'viewUndetermined-impression'
  | 'error';

export type VASTMediaFileDelivery = 'progressive' | 'streaming';
export type VASTMediaFileType =
  | 'video/mp4'
  | 'video/webm'
  | 'application/x-mpegURL'
  | 'application/dash+xml'
  | (string & {});

export interface VASTMediaFile {
  id?: string;
  src: string;
  type: VASTMediaFileType;
  delivery: VASTMediaFileDelivery;
  bitrate?: number;
  width?: number;
  height?: number;
  scalable?: boolean;
  maintainAspectRatio?: boolean;
  codec?: string;
  apiFramework?: string;
}

export interface VASTInteractiveCreativeFile {
  src: string;
  type: string;
  apiFramework: string;
  variableDuration?: boolean;
}

export type VASTCompanionResource =
  | { kind: 'static'; src: string; type: string }
  | { kind: 'iframe'; src: string }
  | { kind: 'html'; html: string };

export interface VASTCompanion {
  id?: string;
  width: number;
  height: number;
  resource: VASTCompanionResource;
  clickThrough?: string;
  clickTrackingUrls: string[];
  trackingEvents: Partial<Record<VASTTrackingEvent, string[]>>;
  altText?: string;
  zoneId?: string;
}

export interface VASTExtension {
  type?: string;
  value?: string;
  children: VASTExtension[];
  attributes: Record<string, string>;
}

// ── S48: OMID Ad Verification ───────────────────────────────────────────────

/**
 * Parsed representation of a single <Verification> block inside <AdVerifications>.
 * Maps to the VAST 4.x AdVerifications spec.
 */
export interface VASTAdVerification {
  /** Vendor identifier (e.g. 'iabtechlab.com-omid'). */
  vendor?: string;
  /** URL of the vendor's JS verification resource. */
  jsUrl: string;
  /** apiFramework attribute on <JavaScriptResource> (typically 'omid'). */
  apiFramework?: string;
  /** Whether the JS resource is optional (browserOptional="true"). */
  browserOptional: boolean;
  /** Opaque parameters string from <VerificationParameters>. */
  verificationParameters?: string;
}

export interface VASTIcon {
  program: string;
  width?: number;
  height?: number;
  xPosition?: string;
  yPosition?: string;
  offset?: number;
  duration?: number;
  src: string;
  type: string;
  clickThrough?: string;
  clickTrackingUrls: string[];
}

export interface VASTAd {
  id?: string;
  sequence?: number;
  adSystem?: string;
  adTitle?: string;
  description?: string;
  advertiser?: string;
  survey?: string;
  impressionUrls: string[];
  errorUrls: string[];
  linear?: VASTLinear;
  companions: VASTCompanion[];
  extensions: VASTExtension[];
  /** S48: Parsed <AdVerifications> block. Empty array when not present. */
  adVerifications: VASTAdVerification[];
  vastVersion?: string;
}

export interface VASTResolveSuccess {
  ok: true;
  ads: VASTAd[];
  requestCount: number;
}

export interface VASTResolveError {
  ok: false;
  errorCode: number;
  message: string;
  requestCount: number;
}

export type VASTResolveResult = VASTResolveSuccess | VASTResolveError;

export interface VASTResolveOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  fetchFn?: (url: string, signal: AbortSignal) => Promise<string>;
  onWrapperResolved?: (depth: number, url: string) => void;
}

export interface VASTLinear {
  duration: number;
  skipOffset?: number | string;
  mediaFiles: VASTMediaFile[];
  interactiveCreativeFiles: VASTInteractiveCreativeFile[];
  clickThrough?: string;
  clickTrackingUrls: string[];
  customClickUrls: string[];
  trackingEvents: Partial<Record<VASTTrackingEvent, string[]>>;
  icons: VASTIcon[];
  adParameters?: string;
}

export type VASTErrorCode = number;
