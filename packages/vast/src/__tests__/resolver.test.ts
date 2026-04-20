import { DOMParser as XmldomParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';
import { resolveVAST } from '../resolver.js';

if (typeof DOMParser === 'undefined') {
  (globalThis as typeof globalThis & { DOMParser: typeof DOMParser }).DOMParser = XmldomParser as unknown as typeof DOMParser;
}

describe('resolveVAST', () => {
  it('follows one wrapper and returns the inline ad', async () => {
    const wrapperXml = `<VAST version="4.2"><Ad id="wrapper-1"><Wrapper followAdditionalWrappers="true"><VASTAdTagURI>https://example.com/inline.xml</VASTAdTagURI><Impression>https://wrapper.example.com/imp</Impression></Wrapper></Ad></VAST>`;
    const inlineXml = `<VAST version="4.2"><Ad id="ad-001"><InLine><AdSystem>SMX</AdSystem><Impression>https://inline.example.com/imp</Impression><Creatives><Creative><Linear><Duration>00:00:10</Duration><MediaFiles><MediaFile delivery="progressive" type="video/mp4">https://cdn.example.com/ad.mp4</MediaFile></MediaFiles></Linear></Creative></Creatives></InLine></Ad></VAST>`;

    const fetchFn = async (url: string) => {
      if (url.includes('inline.xml')) return inlineXml;
      return wrapperXml;
    };

    const result = await resolveVAST('https://example.com/wrapper.xml', { fetchFn: async (url) => fetchFn(url) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected success');
    expect(result.ads[0]?.impressionUrls).toEqual([
      'https://wrapper.example.com/imp',
      'https://inline.example.com/imp',
    ]);
  });
});
