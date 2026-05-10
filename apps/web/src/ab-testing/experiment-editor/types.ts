export type ExperimentStatus = 'active' | 'paused' | 'ended';

export interface Variant {
  id?: string;
  name: string;
  weight: number;
}

export interface Experiment {
  id: string;
  name: string;
  tagId: string;
  tagName?: string;
  status: ExperimentStatus;
  variants: Variant[];
  createdAt: string;
}

export interface VariantResult {
  variantId: string;
  variantName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  isWinner: boolean;
}

export interface ExperimentResults {
  experimentId: string;
  variants: VariantResult[];
  totalImpressions: number;
  enoughData: boolean;
}

export interface Tag {
  id: string;
  name: string;
}

export function normalizeExperimentStatus(status: unknown): ExperimentStatus {
  if (status === 'running' || status === 'active') return 'active';
  if (status === 'completed' || status === 'ended') return 'ended';
  return 'paused';
}

export function toApiExperimentStatus(status: ExperimentStatus): string {
  if (status === 'active') return 'running';
  if (status === 'ended') return 'completed';
  return 'paused';
}

export function normalizeExperiment(raw: any): Experiment {
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? 'Untitled experiment'),
    tagId: String(raw?.tagId ?? raw?.tag_id ?? ''),
    tagName: raw?.tagName ?? raw?.tag_name ?? undefined,
    status: normalizeExperimentStatus(raw?.status),
    variants: Array.isArray(raw?.variants) ? raw.variants.map((variant: any) => ({
      id: variant?.id ? String(variant.id) : undefined,
      name: String(variant?.name ?? 'Variant'),
      weight: Number(variant?.weight ?? 0) || 0,
    })) : [],
    createdAt: String(raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()),
  };
}
