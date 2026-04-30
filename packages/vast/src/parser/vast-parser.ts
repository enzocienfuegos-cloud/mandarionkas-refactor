import type {
  VASTAd,
  VASTCompanion,
  VASTCompanionResource,
  VASTExtension,
  VASTIcon,
  VASTInteractiveCreativeFile,
  VASTLinear,
  VASTMediaFile,
  VASTMediaFileDelivery,
  VASTTrackingEvent,
} from '../types.js';
import { VASTErrors } from '../errors.js';
import { attr, getAll, getText, parseDuration, parseSkipOffset, parseXml } from './xml.js';

export interface VASTWrapperDescriptor {
  kind: 'wrapper';
  vastAdTagUri: string;
  partial: Partial<VASTAd>;
  followAdditionalWrappers: boolean;
}

export type ParsedAdResult =
  | { kind: 'inline'; ad: VASTAd }
  | VASTWrapperDescriptor;

export function parseVAST(rawXml: string): ParsedAdResult[] {
  const doc = parseXml(rawXml);
  const vastEl = getAll(doc, 'VAST')[0];
  if (!vastEl) {
    throw VASTErrors.parseError('Root <VAST> element not found');
  }

  const version = attr(vastEl, 'version');
  const adElements = getAll(vastEl, ':scope > Ad');
  if (adElements.length === 0) {
    throw VASTErrors.noAds();
  }

  return adElements.map((adEl) => parseAd(adEl, version));
}

function parseAd(adEl: Element, vastVersion: string | undefined): ParsedAdResult {
  const id = attr(adEl, 'id');
  const sequence = attr(adEl, 'sequence') ? Number(attr(adEl, 'sequence')) : undefined;
  const inLineEl = getAll(adEl, ':scope > InLine')[0];
  const wrapperEl = getAll(adEl, ':scope > Wrapper')[0];

  if (inLineEl) {
    return { kind: 'inline', ad: parseInLine(inLineEl, { id, sequence, vastVersion }) };
  }
  if (wrapperEl) {
    return parseWrapper(wrapperEl, { id, sequence, vastVersion });
  }
  throw VASTErrors.schemaError(`<Ad id="${id}"> has neither <InLine> nor <Wrapper>`);
}

interface AdMeta {
  id?: string;
  sequence?: number;
  vastVersion?: string;
}

function parseInLine(el: Element, meta: AdMeta): VASTAd {
  const adSystem = getText(el, 'AdSystem');
  const adTitle = getText(el, 'AdTitle');
  const description = getText(el, 'Description');
  const advertiser = getText(el, 'Advertiser');
  const survey = getText(el, 'Survey');
  const impressionUrls = getAll(el, 'Impression').map((item) => item.textContent?.trim()).filter(Boolean) as string[];
  const errorUrls = getAll(el, 'Error').map((item) => item.textContent?.trim()).filter(Boolean) as string[];
  const creativeEls = getAll(el, 'Creatives > Creative');

  let linear: VASTLinear | undefined;
  const companions: VASTCompanion[] = [];
  for (const creativeEl of creativeEls) {
    const linearEl = getAll(creativeEl, ':scope > Linear')[0];
    const companionAdsEl = getAll(creativeEl, ':scope > CompanionAds')[0];
    if (linearEl && !linear) linear = parseLinear(linearEl);
    if (companionAdsEl) companions.push(...parseCompanionAds(companionAdsEl));
  }

  const extensions = getAll(el, 'Extensions > Extension').map(parseExtension);

  return {
    id: meta.id,
    sequence: meta.sequence,
    vastVersion: meta.vastVersion,
    adSystem,
    adTitle,
    description,
    advertiser,
    survey,
    impressionUrls,
    errorUrls,
    linear,
    companions,
    extensions,
  };
}

function parseWrapper(el: Element, meta: AdMeta): VASTWrapperDescriptor {
  const vastAdTagUri = getText(el, 'VASTAdTagURI');
  if (!vastAdTagUri) {
    throw VASTErrors.schemaError('<Wrapper> is missing <VASTAdTagURI>');
  }

  return {
    kind: 'wrapper',
    vastAdTagUri,
    followAdditionalWrappers: attr(el, 'followAdditionalWrappers') !== 'false',
    partial: {
      id: meta.id,
      sequence: meta.sequence,
      adSystem: getText(el, 'AdSystem'),
      impressionUrls: getAll(el, 'Impression').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
      errorUrls: getAll(el, 'Error').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
      companions: [],
      extensions: getAll(el, 'Extensions > Extension').map(parseExtension),
    },
  };
}

function parseLinear(el: Element): VASTLinear {
  const durationText = getText(el, 'Duration');
  const duration = parseDuration(durationText);
  if (Number.isNaN(duration)) {
    throw VASTErrors.schemaError(`Invalid or missing <Duration>: "${durationText}"`);
  }

  return {
    duration,
    skipOffset: parseSkipOffset(attr(el, 'skipoffset') ?? attr(el, 'skipOffset')),
    mediaFiles: getAll(el, 'MediaFiles > MediaFile').map(parseMediaFile),
    interactiveCreativeFiles: getAll(el, 'MediaFiles > InteractiveCreativeFile').map(parseInteractiveCreativeFile),
    clickThrough: getText(el, 'VideoClicks > ClickThrough'),
    clickTrackingUrls: getAll(el, 'VideoClicks > ClickTracking').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
    customClickUrls: getAll(el, 'VideoClicks > CustomClick').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
    trackingEvents: parseTrackingEvents(el),
    icons: getAll(el, 'Icons > Icon').map(parseIcon),
    adParameters: getText(el, 'AdParameters'),
  };
}

function parseMediaFile(el: Element): VASTMediaFile {
  return {
    id: attr(el, 'id'),
    src: el.textContent?.trim() ?? '',
    type: (attr(el, 'type') ?? 'video/mp4') as VASTMediaFile['type'],
    delivery: (attr(el, 'delivery') ?? 'progressive') as VASTMediaFileDelivery,
    bitrate: attr(el, 'bitrate') ? Number(attr(el, 'bitrate')) : undefined,
    width: attr(el, 'width') ? Number(attr(el, 'width')) : undefined,
    height: attr(el, 'height') ? Number(attr(el, 'height')) : undefined,
    scalable: attr(el, 'scalable') === 'true',
    maintainAspectRatio: attr(el, 'maintainAspectRatio') !== 'false',
    codec: attr(el, 'codec'),
    apiFramework: attr(el, 'apiFramework'),
  };
}

function parseInteractiveCreativeFile(el: Element): VASTInteractiveCreativeFile {
  return {
    src: el.textContent?.trim() ?? '',
    type: attr(el, 'type') ?? '',
    apiFramework: attr(el, 'apiFramework') ?? '',
    variableDuration: attr(el, 'variableDuration') === 'true',
  };
}

function parseTrackingEvents(parent: Element): Partial<Record<VASTTrackingEvent, string[]>> {
  const result: Partial<Record<VASTTrackingEvent, string[]>> = {};
  getAll(parent, 'TrackingEvents > Tracking').forEach((el) => {
    const event = attr(el, 'event') as VASTTrackingEvent | undefined;
    const url = el.textContent?.trim();
    if (!event || !url) return;
    if (!result[event]) result[event] = [];
    result[event]!.push(url);
  });
  return result;
}

function parseCompanionAds(el: Element): VASTCompanion[] {
  return getAll(el, ':scope > Companion').map(parseCompanion);
}

function parseCompanion(el: Element): VASTCompanion {
  const width = Number(attr(el, 'width') ?? 0);
  const height = Number(attr(el, 'height') ?? 0);
  const id = attr(el, 'id');
  const zoneId = attr(el, 'adSlotID');

  let resource: VASTCompanionResource;
  const staticEl = getAll(el, ':scope > StaticResource')[0];
  const iframeEl = getAll(el, ':scope > IFrameResource')[0];
  const htmlEl = getAll(el, ':scope > HTMLResource')[0];

  if (staticEl) {
    resource = { kind: 'static', src: staticEl.textContent?.trim() ?? '', type: attr(staticEl, 'creativeType') ?? 'image/jpeg' };
  } else if (iframeEl) {
    resource = { kind: 'iframe', src: iframeEl.textContent?.trim() ?? '' };
  } else if (htmlEl) {
    resource = { kind: 'html', html: htmlEl.textContent ?? '' };
  } else {
    resource = { kind: 'static', src: '', type: '' };
  }

  return {
    id,
    width,
    height,
    zoneId,
    resource,
    clickThrough: getText(el, 'CompanionClickThrough'),
    clickTrackingUrls: getAll(el, 'CompanionClickTracking').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
    trackingEvents: parseTrackingEvents(el),
    altText: getText(el, 'AltText'),
  };
}

function parseIcon(el: Element): VASTIcon {
  return {
    program: attr(el, 'program') ?? '',
    width: attr(el, 'width') ? Number(attr(el, 'width')) : undefined,
    height: attr(el, 'height') ? Number(attr(el, 'height')) : undefined,
    xPosition: attr(el, 'xPosition'),
    yPosition: attr(el, 'yPosition'),
    offset: parseDuration(attr(el, 'offset')),
    duration: parseDuration(attr(el, 'duration')),
    src: getText(el, 'StaticResource') ?? '',
    type: attr(getAll(el, 'StaticResource')[0] ?? el, 'creativeType') ?? '',
    clickThrough: getText(el, 'IconClicks > IconClickThrough'),
    clickTrackingUrls: getAll(el, 'IconClicks > IconClickTracking').map((item) => item.textContent?.trim()).filter(Boolean) as string[],
  };
}

function parseExtension(el: Element): VASTExtension {
  return {
    type: attr(el, 'type'),
    value: el.textContent?.trim(),
    attributes: Array.from(el.attributes ?? []).reduce<Record<string, string>>((acc, item) => {
      acc[item.name] = item.value;
      return acc;
    }, {}),
    children: getAll(el, ':scope > *').map(parseExtensionChild),
  };
}

function parseExtensionChild(el: Element): VASTExtension {
  return {
    type: attr(el, 'type'),
    value: el.textContent?.trim(),
    attributes: Array.from(el.attributes ?? []).reduce<Record<string, string>>((acc, item) => {
      acc[item.name] = item.value;
      return acc;
    }, {}),
    children: getAll(el, ':scope > *').map(parseExtensionChild),
  };
}
