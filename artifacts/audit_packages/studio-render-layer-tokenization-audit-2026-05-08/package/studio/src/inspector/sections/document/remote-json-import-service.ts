import { fetchJson } from '../../../shared/net/http-json';
import type { FeedRecord } from '../../../domain/document/types';

export function normalizeRemoteRecords(payload: unknown): FeedRecord[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : payload && typeof payload === 'object' && Array.isArray((payload as { records?: unknown[] }).records)
        ? (payload as { records: unknown[] }).records
        : payload && typeof payload === 'object'
          ? [payload]
          : [];

  return raw.map((entry, index) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    return {
      id: String(record.id ?? `custom_${index + 1}`),
      label: String(record.label ?? record.name ?? `Record ${index + 1}`),
      values: Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value == null ? '' : String(value)])),
    };
  });
}

export async function importRemoteJsonRecords(url: string): Promise<FeedRecord[]> {
  const payload = await fetchJson<unknown>(url);
  return normalizeRemoteRecords(payload);
}
