import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, Modal, Panel } from '../../system';
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
        <Panel className="border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </Panel>
      ) : !results ? (
        <p className="py-8 text-center text-text-muted">No results available</p>
      ) : (
        <>
          {!results.enoughData && (
            <Panel className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/18 dark:bg-amber-500/10 dark:text-amber-100">
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
                  ? 'border-emerald-300 bg-emerald-50/80 p-4 dark:border-emerald-500/18 dark:bg-emerald-500/10'
                  : 'p-4'}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{variant.variantName}</span>
                    {variant.isWinner && results.enoughData && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-200">
                        Winner
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-brand-fg">{variant.ctr.toFixed(3)}% CTR</span>
                </div>

                <div className="mb-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={variant.isWinner && results.enoughData ? 'h-full rounded-full bg-emerald-500 transition-all' : 'h-full rounded-full bg-brand transition-all'}
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
