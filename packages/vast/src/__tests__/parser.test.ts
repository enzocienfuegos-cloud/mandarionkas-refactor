import { DOMParser as XmldomParser } from '@xmldom/xmldom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VASTError } from '../errors.js';
import { parseVAST } from '../parser/vast-parser.js';

if (typeof DOMParser === 'undefined') {
  (globalThis as typeof globalThis & { DOMParser: typeof DOMParser }).DOMParser = XmldomParser as unknown as typeof DOMParser;
}

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(__dir, 'fixtures', name), 'utf-8');

describe('parseVAST', () => {
  it('parses inline linear ads', () => {
    const results = parseVAST(fixture('inline-linear.xml'));
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('inline');
    if (results[0].kind !== 'inline') throw new Error('expected inline');
    expect(results[0].ad.id).toBe('ad-001');
    expect(results[0].ad.linear?.duration).toBe(30);
    expect(results[0].ad.linear?.mediaFiles).toHaveLength(3);
    expect(results[0].ad.companions).toHaveLength(1);
  });

  it('parses wrappers', () => {
    const results = parseVAST(fixture('wrapper-chain.xml'));
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('wrapper');
    if (results[0].kind !== 'wrapper') throw new Error('expected wrapper');
    expect(results[0].vastAdTagUri).toContain('/vast/inline');
  });

  it('throws VASTError on empty VAST', () => {
    expect(() => parseVAST(fixture('no-ads.xml'))).toThrow(VASTError);
  });
});
