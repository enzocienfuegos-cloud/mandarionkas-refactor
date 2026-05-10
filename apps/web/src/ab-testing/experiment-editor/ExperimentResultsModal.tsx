import React, { useEffect, useState } from 'react';
import { Badge, Button, CenteredSpinner, EmptyState, Modal, Panel } from '../../system';
import { type Experiment, type ExperimentResults } from './types';

export function ExperimentResultsModal({
  experiment,
  onClose,
}: {
  experiment: Experiment;
  onClose: () => void;
}) {
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/v1/experiments/${experiment.id}/results`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load results');
        return response.json();
      })
      .then((data) => {
        const payload = data?.results ?? data ?? {};
        const variants = Array.isArray(payload?.variants) ? payload.variants : [];
        const normalized: ExperimentResults = {
          experimentId: String(payload?.experiment?.id ?? experiment.id),
          variants: variants.map((variant: any) => ({
            variantId: String(variant?.variantId ?? variant?.id ?? ''),
            variantName: String(variant?.variantName ?? variant?.name ?? 'Variant'),
            impressions: Number(variant?.impressions ?? 0) || 0,
            clicks: Number(variant?.clicks ?? 0) || 0,
            ctr: Number(variant?.ctr ?? 0) || 0,
            isWinner: String(payload?.summary?.winner ?? '') === String(variant?.id ?? variant?.variantId ?? ''),
          })),
          totalImpressions: Number(payload?.totalImpressions ?? payload?.summary?.totalImpressions ?? 0) || 0,
          enoughData: Number(payload?.summary?.totalImpressions ?? 0) >= 100,
        };
        setResults(normalized);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [experiment.id]);

  const maxCtr = results ? Math.max(...results.variants.map((variant) => variant.ctr), 0.001) : 1;

  return (
    <Modal open onClose={onClose} size="lg" title={experiment.name} description="Experiment Results">
      {loading ? (
        <CenteredSpinner label="Loading experiment results…" />
      ) : error ? (
        <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] p-4 text-sm text-[color:var(--dusk-status-critical-fg)]">
          {error}
        </Panel>
      ) : !results ? (
        <EmptyState
          title="No results available"
          description="This experiment has not collected enough data to render a comparison yet."
        />
      ) : (
        <>
          {!results.enoughData && (
            <Panel className="mb-4 border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] p-4 text-sm text-[color:var(--dusk-status-warning-fg)]">
              Not enough data for statistical significance. Keep the experiment running.
            </Panel>
          )}

          <p className="mb-4 text-sm text-text-muted">
            Total impressions: <strong className="text-text-primary">{results.totalImpressions.toLocaleString()}</strong>
          </p>

          <div className="space-y-4">
            {results.variants.map((variant) => (
              <Panel
                key={variant.variantId}
                className={variant.isWinner && results.enoughData
                  ? 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] p-4'
                  : 'p-4'}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{variant.variantName}</span>
                    {variant.isWinner && results.enoughData && (
                      <Badge tone="success" size="sm">Winner</Badge>
                    )}
                  </div>
                  <span className="text-sm font-bold text-brand-fg">{variant.ctr.toFixed(3)}% CTR</span>
                </div>

                <div className="mb-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={variant.isWinner && results.enoughData ? 'h-full rounded-full bg-[color:var(--dusk-status-success-fg)] transition-all' : 'h-full rounded-full bg-brand transition-all'}
                      style={{ width: `${(variant.ctr / maxCtr) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-text-muted">
                  <div>
                    <span className="block text-text-soft">Impressions</span>
                    <strong className="text-text-primary">{variant.impressions.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="block text-text-soft">Clicks</span>
                    <strong className="text-text-primary">{variant.clicks.toLocaleString()}</strong>
                  </div>
                </div>
              </Panel>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={onClose} variant="ghost">Close</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
