import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Tag as TagIcon,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Code,
} from '../../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Kicker,
  Badge,
  EmptyState,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  useToast,
} from '../../system';

type Severity = 'info' | 'warning' | 'critical';

interface Finding {
  severity: Severity;
  title: string;
  detail: string;
}

interface MacroCall {
  raw: string;
  family: string;
}

const SEVERITY_TONE: Record<Severity, 'info' | 'warning' | 'critical'> = {
  info: 'info',
  warning: 'warning',
  critical: 'critical',
};

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  info: <CheckCircle2 className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  critical: <AlertCircle className="h-4 w-4" />,
};

export default function TagValidator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [source, setSource] = useState(EXAMPLE_TAG);
  const [tab, setTab] = useState<'findings' | 'source'>('findings');

  const analysis = useMemo(() => analyseTag(source), [source]);

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(source);
      toast({ tone: 'success', title: 'Source copied' });
    } catch {
      toast({ tone: 'critical', title: 'Could not copy' });
    }
  };

  const findingsByTone = {
    critical: analysis.findings.filter((f) => f.severity === 'critical'),
    warning: analysis.findings.filter((f) => f.severity === 'warning'),
    info: analysis.findings.filter((f) => f.severity === 'info'),
  };

  return (
    <div className="space-y-5 max-w-content mx-auto">
      <header className="dusk-page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" leadingIcon={<ArrowLeft />} onClick={() => navigate('/tools')}>
            Tools
          </Button>
          <div>
            <Kicker>Creative</Kicker>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
              Tag validator
            </h1>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
              Paste a 3rd-party ad tag to inspect its calls, macros, and detect common issues.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel padding="lg">
          <PanelHeader
            title="Tag source"
            subtitle={`${source.length.toLocaleString()} bytes`}
            actions={
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSource(EXAMPLE_TAG)}>
                  Reset
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCopySource}>
                  Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSource('')}>
                  Clear
                </Button>
              </div>
            }
          />
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            placeholder="Paste your tag here…"
            className="
              w-full h-96 p-3 rounded-lg dusk-mono text-xs leading-relaxed
              bg-[color:var(--dusk-surface-muted)]
              border border-[color:var(--dusk-border-default)]
              text-[color:var(--dusk-text-primary)]
              outline-none transition
              hover:border-[color:var(--dusk-border-strong)]
              focus:border-brand-500
            "
            style={{ resize: 'vertical' }}
          />
        </Panel>

        <Panel padding="lg">
          <PanelHeader
            title="Analysis"
            subtitle={analysis.inferredFormat ? `Format: ${analysis.inferredFormat}` : 'Static analysis'}
          />

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge tone={analysis.findings.some((f) => f.severity === 'critical') ? 'critical' : 'success'} dot>
              {findingsByTone.critical.length === 0
                ? 'No critical issues'
                : `${findingsByTone.critical.length} critical issue${findingsByTone.critical.length === 1 ? '' : 's'}`}
            </Badge>
            {findingsByTone.warning.length > 0 && (
              <Badge tone="warning" size="sm">
                {findingsByTone.warning.length} warning{findingsByTone.warning.length === 1 ? '' : 's'}
              </Badge>
            )}
            {analysis.macros.length > 0 && (
              <Badge tone="info" size="sm" variant="outline">
                {analysis.macros.length} macro{analysis.macros.length === 1 ? '' : 's'}
              </Badge>
            )}
            {analysis.scriptCount > 0 && (
              <Badge tone="neutral" size="sm" variant="outline">
                {analysis.scriptCount} script{analysis.scriptCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList aria-label="Analysis sections">
              <Tab value="findings" leadingIcon={<AlertTriangle className="h-4 w-4" />}>
                Findings
              </Tab>
              <Tab value="source" leadingIcon={<Code className="h-4 w-4" />}>
                Macros & scripts
              </Tab>
            </TabsList>

            <TabPanel value="findings">
              {analysis.findings.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  kicker="All clear"
                  title="No issues detected"
                  description="The tag looks well-formed. Always test in your DSP's preview environment too."
                />
              ) : (
                <ul className="space-y-2">
                  {analysis.findings.map((finding, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                      style={{
                        background: `var(--dusk-status-${finding.severity}-bg)`,
                        borderColor: `var(--dusk-status-${finding.severity}-border)`,
                      }}
                    >
                      <span
                        className="shrink-0"
                        style={{ color: `var(--dusk-status-${finding.severity}-fg)` }}
                      >
                        {SEVERITY_ICON[finding.severity]}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[color:var(--dusk-text-primary)]">
                            {finding.title}
                          </p>
                          <Badge tone={SEVERITY_TONE[finding.severity]} size="sm" variant="outline">
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[color:var(--dusk-text-secondary)]">
                          {finding.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabPanel>

            <TabPanel value="source">
              <div className="space-y-4">
                <div>
                  <Kicker>Macros found</Kicker>
                  {analysis.macros.length === 0 ? (
                    <p className="mt-1.5 text-sm text-[color:var(--dusk-text-muted)]">
                      No DSP macros detected.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {analysis.macros.map((macro, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[color:var(--dusk-surface-muted)]"
                        >
                          <code className="dusk-mono text-xs text-[color:var(--dusk-text-primary)] truncate">
                            {macro.raw}
                          </code>
                          <Badge tone="info" size="sm" variant="outline">{macro.family}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <Kicker>Scripts</Kicker>
                  <p className="mt-1.5 text-sm text-[color:var(--dusk-text-secondary)]">
                    {analysis.scriptCount} <span className="text-[color:var(--dusk-text-muted)]">total</span>
                    {analysis.blockingScripts > 0 && (
                      <>
                        {' · '}
                        <span style={{ color: 'var(--dusk-status-warning-fg)' }}>
                          {analysis.blockingScripts} blocking
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </TabPanel>
          </Tabs>
        </Panel>
      </div>
    </div>
  );
}

interface Analysis {
  findings: Finding[];
  macros: MacroCall[];
  scriptCount: number;
  blockingScripts: number;
  inferredFormat: string | null;
}

const MACRO_PATTERNS: { regex: RegExp; family: string }[] = [
  { regex: /\$\{CLICK_URL_ESC\}/g, family: 'Adform / generic' },
  { regex: /\$\{CLICK_URL_UNESC\}/g, family: 'Adform / generic' },
  { regex: /\$\{CLICK_URL\}/g, family: 'Adform / generic' },
  { regex: /%%CLICK_URL_ESC%%/g, family: 'CM360' },
  { regex: /%%CLICK_URL_UNESC%%/g, family: 'CM360' },
  { regex: /%%CLICK_URL%%/g, family: 'CM360' },
  { regex: /\$\{CACHEBUSTER\}/g, family: 'Adform / generic' },
  { regex: /%%CACHEBUSTER%%/g, family: 'CM360' },
  { regex: /\[timestamp\]/gi, family: 'Generic' },
  { regex: /\bclickTAG\b/g, family: 'IAB clickTag' },
  { regex: /\bclickTag\b/g, family: 'IAB clickTag' },
  { regex: /%%VIEW_URL_ESC%%/g, family: 'CM360 viewability' },
  { regex: /\$\{IMP_URL\}/g, family: 'Adform impression' },
  { regex: /\{CRITEO_PIXEL_URL\}/g, family: 'Criteo' },
  { regex: /\{TEADS_CLICK_URL\}/gi, family: 'Teads' },
];

function analyseTag(source: string): Analysis {
  const findings: Finding[] = [];
  const trimmed = source.trim();
  if (!trimmed) {
    return { findings: [], macros: [], scriptCount: 0, blockingScripts: 0, inferredFormat: null };
  }

  const macros: MacroCall[] = [];
  for (const { regex, family } of MACRO_PATTERNS) {
    const matches = trimmed.match(regex);
    if (!matches) continue;
    const seen = new Set<string>();
    for (const m of matches) {
      if (seen.has(m)) continue;
      seen.add(m);
      macros.push({ raw: m, family });
    }
  }

  const scriptOpens = trimmed.match(/<script\b/gi) ?? [];
  const scriptCount = scriptOpens.length;
  const blockingScripts = (trimmed.match(/<script(?![^>]*\basync\b)(?![^>]*\bdefer\b)[^>]*\bsrc=/gi) ?? []).length;

  if (/src=["']http:\/\//i.test(trimmed) || /href=["']http:\/\//i.test(trimmed)) {
    findings.push({
      severity: 'critical',
      title: 'Mixed content (http://) detected',
      detail: 'Browsers will block insecure assets when served from an HTTPS page. Replace with https:// or protocol-relative URLs.',
    });
  }

  if (/document\.write\s*\(/i.test(trimmed)) {
    findings.push({
      severity: 'critical',
      title: 'Uses document.write()',
      detail: 'Most modern DSPs and browsers block document.write in async contexts. Tag will fail to render in many placements.',
    });
  }

  if (blockingScripts > 0) {
    findings.push({
      severity: 'warning',
      title: `${blockingScripts} synchronous script tag(s)`,
      detail: 'Synchronous external scripts block the parser and slow render. Consider adding async or defer.',
    });
  }

  const hasClickMacro = macros.some((m) =>
    /CLICK_URL|clickTAG|clickTag|CRITEO_PIXEL|TEADS_CLICK/i.test(m.raw),
  );
  if (!hasClickMacro && trimmed.length > 0) {
    findings.push({
      severity: 'warning',
      title: 'No click macro detected',
      detail: 'The tag has no recognisable click tracker macro. Clicks may not be attributed to your DSP.',
    });
  }

  const hasCachebuster = macros.some((m) => /CACHEBUSTER|timestamp/i.test(m.raw));
  if (!hasCachebuster && scriptCount > 0) {
    findings.push({
      severity: 'info',
      title: 'No cachebuster macro',
      detail: 'Without a cachebuster, intermediate caches may serve stale creatives. Consider adding ${CACHEBUSTER}.',
    });
  }

  if (/<iframe\b/i.test(trimmed) && !/(\bwidth=|\bheight=)/i.test(trimmed)) {
    findings.push({
      severity: 'warning',
      title: 'iframe missing dimensions',
      detail: 'Iframes without explicit width/height collapse to 0x0 in many DSP environments. Set both attributes.',
    });
  }

  let inferredFormat: string | null = null;
  if (/<video\b/i.test(trimmed)) inferredFormat = 'Video (HTML5)';
  else if (/VAST\b/.test(trimmed)) inferredFormat = 'VAST';
  else if (/<iframe\b/i.test(trimmed)) inferredFormat = 'iframe wrapper';
  else if (/<script\b/i.test(trimmed)) inferredFormat = 'Script wrapper';
  else if (/<a\b[^>]*href=/i.test(trimmed)) inferredFormat = 'Anchor / clickThrough';

  return { findings, macros, scriptCount, blockingScripts, inferredFormat };
}

const EXAMPLE_TAG = `<!-- Example display tag (Adform style) -->
<script type="text/javascript" src="https://track.adform.net/serving/scripts/trackpoint/async/?bn=1234567"></script>
<noscript>
  <a href="\${CLICK_URL}https://example.com/landing" target="_blank">
    <img src="https://track.adform.net/adfserve/?bn=1234567;srctype=4;ord=\${CACHEBUSTER}"
         border="0" width="300" height="250" alt="" />
  </a>
</noscript>`;
