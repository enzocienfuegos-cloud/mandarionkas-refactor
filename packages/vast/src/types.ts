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
  vastVersion?: string;
}

export interface VASTResolveSuccess {
  ok: true;
  ads: VASTAd[];
  requestCount: number;
}

export interface VASTResolveError {
  ok: false;
  errorCode: VASTErrorCode;
  message: string;
  requestCount: number;
}

export type VASTResolveResult = VASTResolveSuccess | VASTResolveError;

export type VASTErrorCode =
  | 100
  | 101
  | 102
  | 200
  | 201
  | 202
  | 203
  | 300
  | 301
  | 302
  | 303
  | 400
  | 401
  | 402
  | 403
  | 405
  | 500
  | 501
  | 502
  | 601
  | 900
  | 901;

export interface VASTResolveOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  fetchFn?: (url: string, signal: AbortSignal) => Promise<string>;
  onWrapperResolved?: (depth: number, url: string) => void;
}
