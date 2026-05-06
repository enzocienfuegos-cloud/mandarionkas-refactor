import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Code,
} from '../../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Input,
  Select,
  FormField,
  Kicker,
  Badge,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  useToast,
} from '../../system';

type Dsp = 'adform' | 'cm360' | 'basis' | 'criteo' | 'teads' | 'iab';

interface DspMacros {
  label: string;
  click: string;
  cachebuster: string;
  imp: string;
  view?: string;
  notes?: string;
}

const DSP_MACROS: Record<Dsp, DspMacros> = {
  adform: {
    label: 'Adform',
    click: '${CLICK_URL_ESC}',
    cachebuster: '${CACHEBUSTER}',
    imp: '${IMP_URL}',
    notes: 'Use _ESC variant when the destination URL is appended to ${CLICK_URL_ESC}.',
  },
  cm360: {
    label: 'CM360 (Google Campaign Manager)',
    click: '%%CLICK_URL_ESC%%',
    cachebuster: '%%CACHEBUSTER%%',
    imp: '%%VIEW_URL_UNESC%%',
    view: '%%VIEW_URL_ESC%%',
    notes: 'For 1x1 trackers use %%CLICK_URL_UNESC%% to avoid double-encoding.',
  },
  basis: {
    label: 'Basis (Centro)',
    click: '%%CLICK_URL%%',
    cachebuster: '[timestamp]',
    imp: '[impression_url]',
    notes: 'Basis prefers bracket syntax; macros are case-insensitive.',
  },
  criteo: {
    label: 'Criteo',
    click: '${CLICK_URL_ESC}',
    cachebuster: '${CACHEBUSTER}',
    imp: '${IMP_URL}',
    notes: 'Criteo dynamic creatives use product_id macros — see Criteo docs for full list.',
  },
  teads: {
    label: 'Teads',
    click: '%%TEADS_CLICK_URL%%',
    cachebuster: '%%TEADS_TIMESTAMP%%',
    imp: '%%TEADS_IMPRESSION_URL%%',
    notes: 'Teads outstream uses different macros — this set covers inRead and inFeed.',
  },
  iab: {
    label: 'IAB clickTag (HTML5)',
    click: 'clickTag',
    cachebuster: '',
    imp: '',
    notes: 'Set as a global variable in the creative and read inside the click handler.',
  },
};

const URL_PARAMS_PRESETS = [
  { label: 'utm_source / utm_medium / utm_campaign', value: 'utm_source=dusk&utm_medium=display&utm_campaign={CAMPAIGN_ID}' },
  { label: 'utm_source / utm_medium only', value: 'utm_source=dusk&utm_medium=display' },
  { label: 'gclid (passthrough)', value: 'gclid={GCLID}' },
  { label: 'No UTM (clean URL)', value: '' },
];

export default function MacroBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [dsp, setDsp] = useState<Dsp>('adform');
  const [destination, setDestination] = useState('https://example.com/landing');
  const [params, setParams] = useState(URL_PARAMS_PRESETS[0].value);
  const [tab, setTab] = useState<'wrapped' | 'snippet'>('wrapped');

  const macros = DSP_MACROS[dsp];

  const finalUrl = useMemo(() => {
    if (!destination) return '';
    const sep = destination.includes('?') ? '&' : '?';
    const cleaned = params.trim();
    return cleaned ? `${destination}${sep}${cleaned}` : destination;
  }, [destination, params]);

  const wrapped = useMemo(() => {
    if (!finalUrl) return '';
    if (dsp === 'iab') {
      return `clickTag = "${finalUrl}";`;
    }
    return `${macros.click}${encodeURIComponent(finalUrl)}`;
  }, [finalUrl, dsp, macros.click]);

  const snippet = useMemo(() => generateSnippet(dsp, finalUrl, macros), [dsp, finalUrl, macros]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: `${label} copied` });
    } catch {
      toast({ tone: 'critical', title: 'Could not copy' });
    }
  };

  return (
    <div className="space-y-5 max-w-content mx-auto">
      <header className="dusk-page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" leadingIcon={<ArrowLeft />} onClick={() => navigate('/tools')}>
            Tools
          </Button>
          <div>
            <Kicker>Trafficking</Kicker>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
              Macro builder
            </h1>
            <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
              Compose DSP-specific click and view macros wrapped around your destination URL.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel padding="lg">
          <PanelHeader title="Inputs" />
          <div className="space-y-5">
            <FormField label="DSP / Platform">
              <Select
                value={dsp}
                onChange={(e) => setDsp(e.target.value as Dsp)}
                options={(Object.keys(DSP_MACROS) as Dsp[]).map((key) => ({
                  value: key,
                  label: DSP_MACROS[key].label,
                }))}
              />
            </FormField>

            <FormField label="Destination URL" required helper="The landing page after the click">
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="https://example.com/landing"
                className="dusk-mono"
              />
            </FormField>

            <FormField label="URL parameters" helper="Appended after the destination">
              <Select
                value={params}
                onChange={(e) => setParams(e.target.value)}
                options={URL_PARAMS_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
              />
              <Input
                value={params}
                onChange={(e) => setParams(e.target.value)}
                placeholder="utm_source=…&utm_medium=…"
                className="dusk-mono mt-2"
              />
            </FormField>

            {macros.notes && (
              <div
                role="note"
                className="rounded-lg p-3 text-xs"
                style={{
                  background: 'var(--dusk-status-info-bg)',
                  border: '1px solid var(--dusk-status-info-border)',
                  color: 'var(--dusk-status-info-fg)',
                }}
              >
                <span className="font-medium">{macros.label}</span> — {macros.notes}
              </div>
            )}
          </div>
        </Panel>

        <Panel padding="lg">
          <PanelHeader
            title="Output"
            subtitle={dsp === 'iab' ? 'HTML5 clickTag snippet' : 'Wrapped click URL'}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList aria-label="Output formats">
              <Tab value="wrapped">Wrapped URL</Tab>
              <Tab value="snippet" leadingIcon={<Code className="h-4 w-4" />}>HTML snippet</Tab>
            </TabsList>

            <TabPanel value="wrapped">
              <div className="space-y-3">
                <CodeBlock
                  label="Click-tracked URL"
                  code={wrapped || '—'}
                  onCopy={() => handleCopy(wrapped, 'Wrapped URL')}
                  disabled={!wrapped}
                />

                <div className="grid grid-cols-2 gap-2">
                  <CodeBlock
                    label="Click macro"
                    code={macros.click}
                    onCopy={() => handleCopy(macros.click, 'Click macro')}
                    compact
                  />
                  {macros.cachebuster && (
                    <CodeBlock
                      label="Cachebuster"
                      code={macros.cachebuster}
                      onCopy={() => handleCopy(macros.cachebuster, 'Cachebuster')}
                      compact
                    />
                  )}
                </div>

                {finalUrl && (
                  <div className="pt-2">
                    <Kicker>Resolved destination</Kicker>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="dusk-mono text-xs text-[color:var(--dusk-text-secondary)] truncate flex-1">
                        {finalUrl}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        trailingIcon={<ExternalLink />}
                        onClick={() => window.open(finalUrl, '_blank', 'noopener')}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel value="snippet">
              <CodeBlock
                label={`${macros.label} snippet`}
                code={snippet}
                onCopy={() => handleCopy(snippet, 'Snippet')}
                language="html"
              />
              <p className="mt-2 text-xs text-[color:var(--dusk-text-muted)]">
                Drop this into your creative or send it to the DSP.
              </p>
            </TabPanel>
          </Tabs>
        </Panel>
      </div>

      <Panel padding="lg">
        <PanelHeader title="Quick reference" subtitle="All DSP macros at a glance" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[color:var(--dusk-text-soft)] dusk-kicker">
                <th className="pb-2 pr-4">DSP</th>
                <th className="pb-2 pr-4">Click</th>
                <th className="pb-2 pr-4">Cachebuster</th>
                <th className="pb-2">Impression</th>
              </tr>
            </thead>
            <tbody className="dusk-mono">
              {(Object.keys(DSP_MACROS) as Dsp[]).map((key) => {
                const m = DSP_MACROS[key];
                return (
                  <tr key={key} className="border-t border-[color:var(--dusk-border-subtle)]">
                    <td className="py-2 pr-4 not-italic font-sans text-[color:var(--dusk-text-primary)]">
                      <Badge tone={key === dsp ? 'brand' : 'neutral'} size="sm" variant={key === dsp ? 'solid' : 'outline'}>
                        {m.label}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-[color:var(--dusk-text-secondary)]">{m.click}</td>
                    <td className="py-2 pr-4 text-[color:var(--dusk-text-secondary)]">{m.cachebuster || '—'}</td>
                    <td className="py-2 text-[color:var(--dusk-text-secondary)]">{m.imp || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function CodeBlock({
  label,
  code,
  onCopy,
  language,
  compact,
  disabled,
}: {
  label: string;
  code: string;
  onCopy: () => void;
  language?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Kicker>{label}</Kicker>
        <Button size="sm" variant="ghost" leadingIcon={<Copy />} onClick={onCopy} disabled={disabled}>
          Copy
        </Button>
      </div>
      <pre
        className={`
          rounded-lg p-3 dusk-mono text-xs leading-relaxed overflow-x-auto
          bg-[color:var(--dusk-surface-muted)]
          border border-[color:var(--dusk-border-default)]
          text-[color:var(--dusk-text-primary)]
          ${compact ? 'whitespace-nowrap' : 'whitespace-pre-wrap break-all'}
        `}
        data-language={language}
      >
        {code}
      </pre>
    </div>
  );
}

function generateSnippet(dsp: Dsp, finalUrl: string, macros: DspMacros): string {
  if (!finalUrl) return '<!-- Enter a destination URL above -->';

  if (dsp === 'iab') {
    return `<!-- HTML5 clickTag (declare globally, read in click handler) -->
<script>
  var clickTag = "${finalUrl}";
</script>
<a href="javascript:window.open(window.clickTag)">
  <!-- creative goes here -->
</a>`;
  }

  const wrapped = `${macros.click}${encodeURIComponent(finalUrl)}`;
  const cb = macros.cachebuster ? `?cb=${macros.cachebuster}` : '';
  return `<!-- ${macros.label} click-tracked anchor -->
<a href="${wrapped}" target="_blank" rel="noopener">
  <img src="https://your-cdn.example.com/banner-300x250.jpg${cb}"
       width="300" height="250" alt="" border="0" />
</a>`;
}
