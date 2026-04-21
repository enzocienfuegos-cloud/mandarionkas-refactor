export function handleVastValidatorRoutes(app, { requireWorkspace, pool }) {
  // POST /v1/vast/validate — validate VAST XML
  app.post('/v1/vast/validate', { preHandler: requireWorkspace }, async (req, reply) => {
    const { vastUrl, vastXml } = req.body ?? {};

    if (!vastUrl && !vastXml) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Either vastUrl or vastXml is required',
      });
    }

    let xmlContent = vastXml;

    // Fetch XML from URL if provided
    if (vastUrl && !vastXml) {
      try {
        const url = new URL(vastUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return reply.status(400).send({ error: 'Bad Request', message: 'vastUrl must be an http or https URL' });
        }

        const response = await fetch(vastUrl, {
          headers: { 'User-Agent': 'SMX-Studio-VAST-Validator/1.0' },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          return reply.status(422).send({
            valid: false,
            errors: [`Failed to fetch VAST from URL: HTTP ${response.status}`],
            warnings: [],
            version: null,
          });
        }

        xmlContent = await response.text();
      } catch (err) {
        if (err.name === 'TimeoutError') {
          return reply.status(422).send({
            valid: false,
            errors: ['Request to vastUrl timed out after 10 seconds'],
            warnings: [],
            version: null,
          });
        }
        return reply.status(422).send({
          valid: false,
          errors: [`Could not fetch VAST: ${err.message}`],
          warnings: [],
          version: null,
        });
      }
    }

    // Perform inline VAST validation
    const errors = [];
    const warnings = [];
    let version = null;

    try {
      const trimmed = xmlContent.trim();

      // Must start with XML declaration or VAST tag
      if (!trimmed.includes('<VAST')) {
        errors.push('No <VAST> element found in document');
        return reply.send({ valid: false, errors, warnings, version });
      }

      // Extract version attribute
      const versionMatch = trimmed.match(/<VAST[^>]+version="([^"]+)"/);
      if (!versionMatch) {
        errors.push('<VAST> element is missing required "version" attribute');
      } else {
        version = versionMatch[1];
        const validVersions = ['2.0', '3.0', '4.0', '4.1', '4.2'];
        if (!validVersions.includes(version)) {
          warnings.push(`VAST version "${version}" is not a commonly supported version (expected: ${validVersions.join(', ')})`);
        }
      }

      // Check for required elements
      if (!trimmed.includes('<Ad ') && !trimmed.includes('<Ad>')) {
        errors.push('<VAST> must contain at least one <Ad> element');
      }

      if (trimmed.includes('<InLine>')) {
        // InLine ad — check required children
        if (!trimmed.includes('<AdSystem>') && !trimmed.includes('<AdSystem/>')) {
          errors.push('<InLine> is missing required <AdSystem> element');
        }
        if (!trimmed.includes('<AdTitle>') && !trimmed.includes('<AdTitle/>')) {
          errors.push('<InLine> is missing required <AdTitle> element');
        }
        if (!trimmed.includes('<Impression>') && !trimmed.includes('<Impression/>')) {
          warnings.push('<InLine> has no <Impression> tracking URL');
        }
        if (!trimmed.includes('<Creatives>')) {
          errors.push('<InLine> is missing required <Creatives> element');
        }
      } else if (trimmed.includes('<Wrapper>')) {
        // Wrapper ad — must have VASTAdTagURI
        if (!trimmed.includes('<VASTAdTagURI>') && !trimmed.includes('<VASTAdTagURI/>')) {
          errors.push('<Wrapper> is missing required <VASTAdTagURI> element');
        }
      } else if (trimmed.includes('<Ad ') || trimmed.includes('<Ad>')) {
        errors.push('<Ad> element must contain either <InLine> or <Wrapper>');
      }

      // Check for CDATA in tracking URLs (recommended)
      if (trimmed.includes('<Impression>') && !trimmed.includes('<Impression><![CDATA[')) {
        warnings.push('Impression URLs should be wrapped in CDATA sections');
      }

      // Check for Linear ads having MediaFiles
      if (trimmed.includes('<Linear>') && !trimmed.includes('<MediaFiles>')) {
        errors.push('<Linear> creative is missing required <MediaFiles> element');
      }

      // Check for Duration in Linear
      if (trimmed.includes('<Linear>') && !trimmed.includes('<Duration>')) {
        errors.push('<Linear> creative is missing required <Duration> element');
      }

    } catch (parseErr) {
      errors.push(`XML parsing error: ${parseErr.message}`);
    }

    const valid = errors.length === 0;
    return reply.send({ valid, errors, warnings, version });
  });

  // POST /v1/vast/chain — resolve VAST wrapper chain
  app.post('/v1/vast/chain', { preHandler: requireWorkspace }, async (req, reply) => {
    const { vastUrl } = req.body ?? {};

    if (!vastUrl) {
      return reply.status(400).send({ error: 'Bad Request', message: 'vastUrl is required' });
    }

    try {
      new URL(vastUrl);
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'vastUrl must be a valid URL' });
    }

    const chain = [];
    const MAX_DEPTH = 5;
    let currentUrl = vastUrl;
    let hasMedia = false;

    async function fetchAndParse(url, depth) {
      if (depth > MAX_DEPTH) return;

      let xmlText;
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'SMX-Studio-VAST-Validator/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          chain.push({ url, version: null, type: 'error', error: `HTTP ${response.status}`, depth });
          return;
        }
        xmlText = await response.text();
      } catch (err) {
        chain.push({ url, version: null, type: 'error', error: err.message, depth });
        return;
      }

      const versionMatch = xmlText.match(/<VAST[^>]+version="([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : null;

      const isWrapper = xmlText.includes('<Wrapper>');
      const isInLine = xmlText.includes('<InLine>');
      const type = isWrapper ? 'wrapper' : isInLine ? 'inline' : 'unknown';

      if (xmlText.includes('<MediaFiles>')) {
        hasMedia = true;
      }

      chain.push({ url, version, type, depth });

      // If wrapper, find VASTAdTagURI and follow
      if (isWrapper) {
        const tagUriMatch = xmlText.match(/<VASTAdTagURI[^>]*><!\[CDATA\[(.*?)\]\]><\/VASTAdTagURI>/s)
          ?? xmlText.match(/<VASTAdTagURI[^>]*>(.*?)<\/VASTAdTagURI>/s);
        if (tagUriMatch) {
          const nextUrl = tagUriMatch[1].trim();
          await fetchAndParse(nextUrl, depth + 1);
        }
      }
    }

    await fetchAndParse(currentUrl, 1);

    return reply.send({
      chain,
      depth: chain.length,
      hasMedia,
    });
  });
}
