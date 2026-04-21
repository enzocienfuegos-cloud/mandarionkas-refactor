/**
 * packages/vast-validator/__tests__/validator.test.mjs
 * Tests for the VAST structural validator — no DB, no network.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateVast, validateVastChain } from '../src/validator.mjs';

// ── fixture XML ───────────────────────────────────────────────────────────

const VALID_INLINE = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0">
  <Ad id="1">
    <InLine>
      <AdSystem>Test</AdSystem>
      <AdTitle>Demo</AdTitle>
      <Impression><![CDATA[https://track.example.com/imp]]></Impression>
      <Creatives>
        <Creative>
          <Linear>
            <Duration>00:00:30.000</Duration>
            <MediaFiles>
              <MediaFile type="video/mp4" width="1920" height="1080">
                <![CDATA[https://cdn.example.com/ad.mp4]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;

const VALID_WRAPPER = `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.0">
  <Ad id="w1">
    <Wrapper>
      <AdSystem>Test</AdSystem>
      <VASTAdTagURI><![CDATA[https://upstream.example.com/vast]]></VASTAdTagURI>
    </Wrapper>
  </Ad>
</VAST>`;

// ── validateVast — valid inline ───────────────────────────────────────────

describe('validateVast — valid InLine', () => {
  it('returns valid=true', () => {
    const r = validateVast(VALID_INLINE);
    assert.equal(r.valid, true, `errors: ${r.errors.join(', ')}`);
  });

  it('returns type="inline"', () => {
    assert.equal(validateVast(VALID_INLINE).type, 'inline');
  });

  it('has no errors', () => {
    assert.deepEqual(validateVast(VALID_INLINE).errors, []);
  });
});

// ── validateVast — valid wrapper ──────────────────────────────────────────

describe('validateVast — valid Wrapper', () => {
  it('returns valid=true', () => {
    const r = validateVast(VALID_WRAPPER);
    assert.equal(r.valid, true, `errors: ${r.errors.join(', ')}`);
  });

  it('returns type="wrapper"', () => {
    assert.equal(validateVast(VALID_WRAPPER).type, 'wrapper');
  });
});

// ── validateVast — invalid inputs ────────────────────────────────────────

describe('validateVast — empty / null input', () => {
  it('returns valid=false for empty string', () => {
    assert.equal(validateVast('').valid, false);
  });

  it('returns valid=false for null', () => {
    assert.equal(validateVast(null).valid, false);
  });

  it('returns valid=false for non-XML string', () => {
    assert.equal(validateVast('not xml at all').valid, false);
  });
});

describe('validateVast — missing required elements', () => {
  it('reports error when <VAST> root is absent', () => {
    const r = validateVast('<root><Ad/></root>');
    assert.ok(r.errors.some(e => e.includes('VAST')));
  });

  it('reports error when <Ad> is absent', () => {
    const r = validateVast('<VAST version="4.0"></VAST>');
    assert.ok(r.errors.some(e => e.includes('<Ad>')));
  });

  it('reports error when neither InLine nor Wrapper present', () => {
    const r = validateVast('<VAST version="4.0"><Ad id="1"></Ad></VAST>');
    assert.ok(r.errors.some(e => e.includes('InLine') || e.includes('Wrapper')));
  });

  it('reports error for InLine missing <Impression>', () => {
    const xml = `<VAST version="4.0"><Ad><InLine>
      <AdSystem>X</AdSystem><Creatives><Creative><Linear>
      <Duration>00:00:30.000</Duration><MediaFiles><MediaFile type="video/mp4" width="1" height="1"><![CDATA[http://x.com]]></MediaFile></MediaFiles>
      </Linear></Creative></Creatives></InLine></Ad></VAST>`;
    const r = validateVast(xml);
    assert.ok(r.errors.some(e => e.toLowerCase().includes('impression')));
  });

  it('reports error for InLine missing <Duration>', () => {
    const xml = `<VAST version="4.0"><Ad><InLine>
      <AdSystem>X</AdSystem><Impression><![CDATA[http://x.com]]></Impression>
      <Creatives><Creative><Linear>
      <MediaFiles><MediaFile type="video/mp4" width="1" height="1"><![CDATA[http://x.com]]></MediaFile></MediaFiles>
      </Linear></Creative></Creatives></InLine></Ad></VAST>`;
    const r = validateVast(xml);
    assert.ok(r.errors.some(e => e.toLowerCase().includes('duration')));
  });

  it('reports error for Wrapper missing <VASTAdTagURI>', () => {
    const xml = `<VAST version="4.0"><Ad><Wrapper><AdSystem>X</AdSystem></Wrapper></Ad></VAST>`;
    const r = validateVast(xml);
    assert.ok(r.errors.some(e => e.includes('VASTAdTagURI')));
  });
});

describe('validateVast — version check', () => {
  it('warns on VAST 2.0', () => {
    const xml = VALID_INLINE.replace('version="4.0"', 'version="2.0"');
    const r = validateVast(xml);
    assert.ok(r.warnings.some(w => w.includes('2')));
  });
});

// ── validateVastChain ─────────────────────────────────────────────────────

describe('validateVastChain', () => {
  it('returns valid=true for wrapper → inline', () => {
    const r = validateVastChain([VALID_WRAPPER, VALID_INLINE]);
    assert.equal(r.valid, true, `chain errors: ${r.chainErrors.join(', ')}`);
  });

  it('returns valid=false for empty array', () => {
    assert.equal(validateVastChain([]).valid, false);
  });

  it('returns valid=false when last is not inline', () => {
    const r = validateVastChain([VALID_WRAPPER, VALID_WRAPPER]);
    assert.equal(r.valid, false);
  });

  it('returns valid=false when non-last is not wrapper', () => {
    const r = validateVastChain([VALID_INLINE, VALID_INLINE]);
    assert.equal(r.valid, false);
  });

  it('errors on chain depth exceeding 5 wrappers', () => {
    const chain = [
      VALID_WRAPPER, VALID_WRAPPER, VALID_WRAPPER,
      VALID_WRAPPER, VALID_WRAPPER, VALID_WRAPPER,
      VALID_INLINE,
    ];
    const r = validateVastChain(chain);
    assert.ok(r.chainErrors.some(e => e.includes('depth') || e.includes('maximum')));
  });

  it('results array length matches input chain length', () => {
    const r = validateVastChain([VALID_WRAPPER, VALID_INLINE]);
    assert.equal(r.results.length, 2);
  });
});
