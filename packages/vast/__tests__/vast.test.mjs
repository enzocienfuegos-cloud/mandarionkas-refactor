/**
 * packages/vast/__tests__/vast.test.mjs
 * Tests for VAST 4.0 XML generation — no DB, no network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVastTag, buildVastWrapper } from '../src/index.mjs';

const BASE = {
  tagId:         'tag-001',
  adTitle:       'Demo Ad',
  mediaUrl:      'https://cdn.example.com/ad.mp4',
  clickUrl:      'https://click.example.com/',
  impressionUrl: 'https://track.example.com/imp',
};

// ── buildVastTag ──────────────────────────────────────────────────────────

describe('buildVastTag', () => {
  it('returns a string', () => {
    assert.equal(typeof buildVastTag(BASE), 'string');
  });

  it('starts with XML declaration', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.startsWith('<?xml'), 'must start with XML declaration');
  });

  it('contains <VAST version="4.0">', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.includes('version="4.0"'), 'must declare VAST 4.0');
  });

  it('contains <InLine>', () => {
    assert.ok(buildVastTag(BASE).includes('<InLine>'));
  });

  it('contains impression URL in CDATA', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.includes('<Impression'), 'must have Impression element');
    assert.ok(xml.includes(BASE.impressionUrl), 'impression URL must appear');
    assert.ok(xml.includes('CDATA'), 'impression URL should be in CDATA');
  });

  it('contains click URL', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.includes(BASE.clickUrl), 'click URL must appear');
  });

  it('contains media URL', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.includes(BASE.mediaUrl), 'media URL must appear');
  });

  it('contains <Duration> element', () => {
    assert.ok(buildVastTag(BASE).includes('<Duration>'));
  });

  it('formats 30-second duration as 00:00:30.000', () => {
    const xml = buildVastTag({ ...BASE, duration: 30 });
    assert.ok(xml.includes('00:00:30.000'), `expected 00:00:30.000 in: ${xml.slice(0, 400)}`);
  });

  it('formats 90-second duration as 00:01:30.000', () => {
    const xml = buildVastTag({ ...BASE, duration: 90 });
    assert.ok(xml.includes('00:01:30.000'));
  });

  it('escapes special chars in adTitle', () => {
    const xml = buildVastTag({ ...BASE, adTitle: 'A & B <test>' });
    assert.ok(!xml.includes('<test>'), 'raw < should be escaped');
    assert.ok(xml.includes('&amp;') || xml.includes('&lt;'), 'should contain XML escapes');
  });

  it('includes tracking events when provided', () => {
    const xml = buildVastTag({
      ...BASE,
      trackingUrls: [
        { event: 'start', url: 'https://track.example.com/start' },
        { event: 'complete', url: 'https://track.example.com/complete' },
      ],
    });
    assert.ok(xml.includes('event="start"'));
    assert.ok(xml.includes('event="complete"'));
  });

  it('contains <MediaFiles> and <MediaFile>', () => {
    const xml = buildVastTag(BASE);
    assert.ok(xml.includes('<MediaFiles>'));
    assert.ok(xml.includes('<MediaFile'));
  });

  it('uses provided width and height on MediaFile', () => {
    const xml = buildVastTag({ ...BASE, width: 640, height: 360 });
    assert.ok(xml.includes('width="640"'));
    assert.ok(xml.includes('height="360"'));
  });
});

// ── buildVastWrapper ──────────────────────────────────────────────────────

describe('buildVastWrapper', () => {
  const WRAP_BASE = {
    tagId:      'wrap-001',
    adTitle:    'Wrapper Ad',
    wrapperUrl: 'https://upstream.example.com/vast',
  };

  it('returns a string', () => {
    assert.equal(typeof buildVastWrapper(WRAP_BASE), 'string');
  });

  it('contains <Wrapper> element', () => {
    assert.ok(buildVastWrapper(WRAP_BASE).includes('<Wrapper'));
  });

  it('does NOT contain <InLine>', () => {
    assert.ok(!buildVastWrapper(WRAP_BASE).includes('<InLine>'));
  });

  it('contains <VASTAdTagURI> with the wrapper URL', () => {
    const xml = buildVastWrapper(WRAP_BASE);
    assert.ok(xml.includes('<VASTAdTagURI>'));
    assert.ok(xml.includes(WRAP_BASE.wrapperUrl));
  });

  it('includes impression URL when provided', () => {
    const xml = buildVastWrapper({ ...WRAP_BASE, impressionUrl: 'https://imp.example.com/' });
    assert.ok(xml.includes('https://imp.example.com/'));
  });
});
