/**
 * @smx/vast-validator — VAST 4.0 XML structural validator
 *
 * Usage:
 *   import { validateVast } from '@smx/vast-validator';
 *   const result = validateVast(xmlString);
 *   // result: { valid: boolean, errors: string[], warnings: string[], type: 'inline'|'wrapper'|null }
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean}  valid
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {'inline'|'wrapper'|null} type
 */

/**
 * Validate a VAST XML string.
 * This is a lightweight structural check — it does NOT perform schema validation
 * but catches the most common integration errors.
 *
 * @param {string} xml
 * @returns {ValidationResult}
 */
export function validateVast(xml) {
  const errors   = [];
  const warnings = [];
  let type       = null;

  if (!xml || typeof xml !== 'string') {
    return { valid: false, errors: ['Input is empty or not a string'], warnings, type };
  }

  const src = xml.trim();

  // Must start with XML declaration or <VAST
  if (!src.startsWith('<?xml') && !src.startsWith('<VAST')) {
    errors.push('Document does not begin with an XML declaration or <VAST> root element');
  }

  // Root <VAST> element
  if (!/<VAST[\s>]/i.test(src)) {
    errors.push('Missing <VAST> root element');
  }

  // VAST version attribute
  const versionMatch = src.match(/<VAST[^>]*version="([^"]+)"/i);
  if (!versionMatch) {
    errors.push('Missing VAST version attribute on <VAST> element');
  } else {
    const ver = versionMatch[1];
    if (!['4.0', '4.1', '4.2', '3.0', '2.0'].includes(ver)) {
      warnings.push(`Unusual VAST version: "${ver}" (expected 4.0)`);
    }
    if (ver.startsWith('2') || ver.startsWith('3')) {
      warnings.push(`VAST ${ver} detected — SMX Studio targets VAST 4.0`);
    }
  }

  // <Ad> element
  if (!/<Ad[\s>]/i.test(src)) {
    errors.push('Missing <Ad> element');
  }

  // Inline vs Wrapper
  const hasInline  = /<InLine>/i.test(src);
  const hasWrapper = /<Wrapper[\s>]/i.test(src);

  if (!hasInline && !hasWrapper) {
    errors.push('Missing <InLine> or <Wrapper> inside <Ad>');
  } else if (hasInline && hasWrapper) {
    errors.push('Both <InLine> and <Wrapper> found in the same <Ad> — only one is allowed');
  } else {
    type = hasInline ? 'inline' : 'wrapper';
  }

  if (hasInline) {
    // Required InLine children
    if (!/<AdSystem[\s>]/i.test(src)) errors.push('Missing <AdSystem> inside <InLine>');
    if (!/<AdTitle>/.test(src))        warnings.push('Missing <AdTitle> (recommended)');
    if (!/<Impression[\s>]/i.test(src)) errors.push('Missing <Impression> inside <InLine>');
    if (!/<Creatives>/i.test(src))      errors.push('Missing <Creatives> block');
    if (!/<Creative[\s>]/i.test(src))   errors.push('Missing at least one <Creative>');
    if (!/<Linear>/i.test(src) && !/<NonLinear>/i.test(src) && !/<CompanionAds>/i.test(src)) {
      errors.push('No <Linear>, <NonLinear>, or <CompanionAds> found inside <Creative>');
    }
    if (/<Linear>/i.test(src)) {
      if (!/<Duration>/.test(src))   errors.push('Missing <Duration> inside <Linear>');
      if (!/<MediaFiles>/i.test(src)) errors.push('Missing <MediaFiles> inside <Linear>');
      if (!/<MediaFile[\s>]/i.test(src)) errors.push('No <MediaFile> found inside <MediaFiles>');
    }
  }

  if (hasWrapper) {
    if (!/<VASTAdTagURI>/i.test(src)) {
      errors.push('Missing <VASTAdTagURI> inside <Wrapper>');
    } else {
      // Extract and validate the URI is not empty
      const uriMatch = src.match(/<VASTAdTagURI>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s\]<]+)/i);
      if (!uriMatch) {
        errors.push('<VASTAdTagURI> appears to be empty or does not contain an HTTP URL');
      }
    }
    if (!/<AdSystem[\s>]/i.test(src)) {
      warnings.push('Missing <AdSystem> inside <Wrapper> (recommended)');
    }
  }

  // Check for CDATA in tracking URLs (optional but recommended)
  const impressionTags = src.match(/<Impression[^>]*>([^<]+)<\/Impression>/gi) ?? [];
  for (const tag of impressionTags) {
    if (!tag.includes('CDATA') && tag.includes('http')) {
      warnings.push('Impression URL not wrapped in CDATA — special characters may break parsing');
    }
  }

  // Mismatched tags (quick heuristic)
  const opens  = (src.match(/<[A-Z][A-Za-z]+[\s>]/g) ?? []).filter(t => !t.startsWith('<?'));
  const closes = (src.match(/<\/[A-Z][A-Za-z]+>/g) ?? []);
  if (Math.abs(opens.length - closes.length) > 2) {
    warnings.push('Tag count mismatch — possible unclosed elements in the VAST document');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    type,
  };
}

/**
 * Validate and score a VAST chain (array of XML strings, outermost first).
 * Each wrapper should resolve to the next entry; the last must be an InLine.
 *
 * @param {string[]} xmlChain
 * @returns {{ valid: boolean, results: ValidationResult[], chainErrors: string[] }}
 */
export function validateVastChain(xmlChain) {
  if (!Array.isArray(xmlChain) || xmlChain.length === 0) {
    return { valid: false, results: [], chainErrors: ['Chain is empty'] };
  }

  const MAX_WRAPPERS = 5;
  const chainErrors  = [];
  const results      = xmlChain.map(xml => validateVast(xml));

  // All but last must be wrappers; last must be inline
  for (let i = 0; i < results.length - 1; i++) {
    if (results[i].type !== 'wrapper') {
      chainErrors.push(`Chain[${i}]: expected Wrapper but got "${results[i].type}"`);
    }
  }
  const last = results[results.length - 1];
  if (last.type !== 'inline') {
    chainErrors.push(`Chain[${results.length - 1}]: final entry must be InLine but got "${last.type}"`);
  }

  if (xmlChain.length - 1 > MAX_WRAPPERS) {
    chainErrors.push(`Chain depth ${xmlChain.length - 1} exceeds IAB maximum of ${MAX_WRAPPERS} wrappers`);
  }

  const allValid = results.every(r => r.valid) && chainErrors.length === 0;
  return { valid: allValid, results, chainErrors };
}
