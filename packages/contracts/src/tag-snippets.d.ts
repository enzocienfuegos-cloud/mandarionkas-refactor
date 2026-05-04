export type SnippetVariant =
  | 'display-js'
  | 'display-js-no-macro'
  | 'display-iframe'
  | 'display-ins'
  | 'native-js'
  | 'tracker-click'
  | 'tracker-impression'
  | 'vast-url-basis-dynamic'
  | 'vast-url-basis-macro'
  | 'vast-url-illumin-dynamic'
  | 'vast-url-illumin-macro'
  | 'vast-url-vast4-dynamic'
  | 'vast-xml';

export interface TagRecord {
  id: string;
  format: string;
  width?: number | null;
  height?: number | null;
  trackerType?: string | null;
}

export function normalizeServingBaseUrl(value: string): string;
export function buildDisplayJsSnippet(args: {
  displayJsUrl: string;
  displayHtmlUrl: string;
  width: number | string;
  height: number | string;
}): string;
export function buildDisplayIframeSnippet(args: {
  displayHtmlUrl: string;
  width: number | string;
  height: number | string;
}): string;
export function buildDisplayInsSnippet(args: {
  displayHtmlUrl: string;
  tagId: string;
  width: number | string;
  height: number | string;
}): string;
export function buildNativeJsSnippet(args: {
  nativeJsUrl: string;
  tagId: string;
}): string;
export function buildTagSnippet(
  tag: TagRecord,
  variant: SnippetVariant,
  servingBaseUrl: string,
  campaignDsp?: string,
  diagnostics?: any,
): string;
