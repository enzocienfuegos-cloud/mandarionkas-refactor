import type { StudioState } from '../domain/document/types';
import { buildZipFromBundle } from './zip';
import type { BudgetMeasurement } from './channel-budgets';
import type { ExportBundle, ExportBundleFile } from './bundle';
import type { ExportAssetPlanEntry } from './assets';

function getBundleFileBytes(file: ExportBundleFile): number {
  return file.bytes?.length ?? new TextEncoder().encode(file.content ?? '').length;
}

export function buildChannelBudgetMeasurement(
  state: StudioState,
  bundle: ExportBundle,
  assetPlan: ExportAssetPlanEntry[],
  runtimeScript: string,
): BudgetMeasurement {
  const assetPaths = new Set(assetPlan.map((entry) => entry.packagingPath));
  const runtimeJsBytes = new TextEncoder().encode(runtimeScript).length;
  const initialLoadBytes = bundle.files.reduce((sum, file) => {
    if (file.path === 'index.html' || file.path === 'runtime.js' || assetPaths.has(file.path)) {
      return sum + getBundleFileBytes(file);
    }
    return sum;
  }, 0);

  return {
    zipBytes: buildZipFromBundle(bundle, state.document.name || 'smx-export').bytes.length,
    initialLoadBytes,
    runtimeJsBytes,
    assetCount: assetPlan.length,
  };
}
