import React, { useMemo, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-javascript';
import { Copy, ExternalLink } from '../icons';
import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { Panel } from '../primitives/Panel';
import { Tab, Tabs, TabsList } from '../primitives/Tabs';
import { useToast } from '../feedback/Toast';

export type TagExportMode =
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
  | 'vast-xml'
  | 'raw_html'
  | 'clicktag_general'
  | 'adform_dhtml'
  | 'adform_mraid'
  | 'cm360_ins'
  | 'dv360_iframe'
  | 'ttd_javascript';

export interface TagSnippetBlockProps {
  snippets: Partial<Record<TagExportMode, string>>;
  defaultMode?: TagExportMode;
  onModeChange?: (mode: TagExportMode) => void;
  onCopy?: (mode: TagExportMode) => void;
  showLineNumbers?: boolean;
  actions?: React.ReactNode;
}

const MODE_LABELS: Record<TagExportMode, string> = {
  'display-js': 'Display JS',
  'display-js-no-macro': 'Display JS (Clean)',
  'display-iframe': 'Display Iframe',
  'display-ins': 'Display INS',
  'native-js': 'Native JS',
  'tracker-click': 'Tracker Click',
  'tracker-impression': 'Tracker Impression',
  'vast-url-basis-dynamic': 'Basis Live XML',
  'vast-url-basis-macro': 'Basis Macro URL',
  'vast-url-illumin-dynamic': 'Illumin Live XML',
  'vast-url-illumin-macro': 'Illumin Macro URL',
  'vast-url-vast4-dynamic': 'VAST 4.x Live XML',
  'vast-xml': 'XML Wrapper',
  raw_html: 'Raw HTML',
  clicktag_general: 'Clicktag',
  adform_dhtml: 'Adform DHTML',
  adform_mraid: 'Adform MRAID',
  cm360_ins: 'CM360 INS',
  dv360_iframe: 'DV360 Iframe',
  ttd_javascript: 'TTD JS',
};

export function TagSnippetBlock({
  snippets,
  defaultMode,
  onModeChange,
  onCopy,
  showLineNumbers = true,
  actions,
}: TagSnippetBlockProps) {
  const availableModes = useMemo(
    () => (Object.keys(snippets) as TagExportMode[]).filter((mode) => snippets[mode]),
    [snippets],
  );
  const [mode, setMode] = useState<TagExportMode>(defaultMode ?? availableModes[0] ?? 'raw_html');
  const { toast } = useToast();
  const code = snippets[mode] ?? '';
  const html = useMemo(
    () => Prism.highlight(code, Prism.languages[mode === 'ttd_javascript' ? 'javascript' : 'markup'], mode === 'ttd_javascript' ? 'javascript' : 'markup'),
    [code, mode],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ tone: 'success', title: `${MODE_LABELS[mode]} copied to clipboard` });
      onCopy?.(mode);
    } catch {
      toast({ tone: 'critical', title: `Couldn’t copy ${MODE_LABELS[mode].toLowerCase()}` });
    }
  };

  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2">
        <Tabs
          value={mode}
          onValueChange={(next) => {
            setMode(next as TagExportMode);
            onModeChange?.(next as TagExportMode);
          }}
        >
          <TabsList>
            {availableModes.map((entry) => (
              <Tab key={entry} value={entry}>{MODE_LABELS[entry]}</Tab>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {actions}
          <Button variant="ghost" size="sm" leadingIcon={<ExternalLink />} onClick={() => window.open(`data:text/plain;charset=utf-8,${encodeURIComponent(code)}`, '_blank')}>
            Open raw
          </Button>
          <Button variant="primary" size="sm" leadingIcon={<Copy />} onClick={() => void handleCopy()}>
            Copy
          </Button>
        </div>
      </div>
      <pre className={cn(
        'dusk-mono max-h-96 overflow-auto bg-surface-muted p-4 text-xs leading-relaxed',
        showLineNumbers && 'grid grid-cols-[auto_1fr] gap-x-4',
      )}>
        {showLineNumbers ? (
          <code aria-hidden className="select-none text-text-soft">
            {code.split('\n').map((_, index) => (
              <span key={`line-${index}`} className="block text-right">
                {index + 1}
              </span>
            ))}
          </code>
        ) : null}
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </Panel>
  );
}
