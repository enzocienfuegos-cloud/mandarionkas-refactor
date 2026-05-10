import React, { useMemo, useState } from 'react';
import { Badge } from '../primitives/Badge';
import { Panel } from '../primitives/Panel';
import { Tab, TabPanel, Tabs, TabsList } from '../primitives/Tabs';

export interface DspMacroSpec {
  dsp: string;
  required: string[];
  optional: string[];
  descriptions?: Record<string, string>;
}

export interface MacroResolverProps {
  tag: string;
  spec: DspMacroSpec;
  mockValues?: Record<string, string>;
}

const MACRO_REGEX = /\$\{([^}]+)\}|%%([^%]+)%%|\[([A-Z_]+)\]/g;

export function MacroResolver({ tag, spec, mockValues }: MacroResolverProps) {
  const [tab, setTab] = useState<'audit' | 'preview'>('audit');
  const detected = useMemo(() => {
    const matches = new Set<string>();
    for (const match of tag.matchAll(MACRO_REGEX)) {
      const macro = match[1] ?? match[2] ?? match[3];
      if (macro) matches.add(macro);
    }
    return [...matches];
  }, [tag]);

  const resolvedPreview = useMemo(() => {
    if (!mockValues) return null;
    return tag.replace(MACRO_REGEX, (_, a, b, c) => {
      const key = a ?? b ?? c;
      return mockValues[key] ?? key;
    });
  }, [mockValues, tag]);

  const rows = useMemo(() => {
    const catalog = [...new Set([...spec.required, ...spec.optional, ...detected])];
    return catalog.map((macro) => {
      const isRequired = spec.required.includes(macro);
      const isOptional = spec.optional.includes(macro);
      const present = detected.includes(macro);
      const status = isRequired
        ? present ? 'ok' : 'error'
        : isOptional
          ? present ? 'info' : 'warning'
          : 'unsupported';
      return {
        macro,
        present,
        status,
        description: spec.descriptions?.[macro],
        label: isRequired ? 'Required' : isOptional ? 'Optional' : 'Unsupported',
      };
    });
  }, [detected, spec]);

  return (
    <Tabs value={tab} onValueChange={(next) => setTab(next as 'audit' | 'preview')}>
      <div className="space-y-4">
        {resolvedPreview ? (
          <TabsList aria-label="Macro resolver sections">
            <Tab value="audit">Macro audit</Tab>
            <Tab value="preview">Resolved preview</Tab>
          </TabsList>
        ) : null}

        <TabPanel value="audit" className="mt-0">
          <Panel padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-text-soft">
                <tr>
                  <th className="px-4 py-3">Macro</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.macro} className="border-t border-border-subtle">
                    <td className="px-4 py-3 dusk-mono text-text-primary">{row.macro}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === 'ok' ? 'success' : row.status === 'error' ? 'critical' : row.status === 'warning' ? 'warning' : row.status === 'unsupported' ? 'neutral' : 'info'}>
                        {row.label}{row.present ? ' present' : ' missing'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{row.description ?? 'No description available'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </TabPanel>

        {resolvedPreview ? (
          <TabPanel value="preview" className="mt-0">
            <Panel className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Resolved preview</p>
              <pre className="overflow-auto rounded-xl bg-surface-muted p-3 text-xs text-text-secondary">{resolvedPreview}</pre>
            </Panel>
          </TabPanel>
        ) : null}
      </div>
    </Tabs>
  );
}
