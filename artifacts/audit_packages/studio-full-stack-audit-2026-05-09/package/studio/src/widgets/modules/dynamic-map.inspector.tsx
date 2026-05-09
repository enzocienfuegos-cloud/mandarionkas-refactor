import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Button } from '../../shared/ui/Button';
import {
  buildNearbyPlacesCsv,
  DYNAMIC_MAP_CTA_OPTIONS,
  DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS,
  DYNAMIC_MAP_DEFAULT_CTA_LABEL,
  DYNAMIC_MAP_DEFAULT_CTA_TYPE,
  DYNAMIC_MAP_DEFAULT_FETCH_POLICY,
  DYNAMIC_MAP_DEFAULT_LATITUDE,
  DYNAMIC_MAP_DEFAULT_LONGITUDE,
  DYNAMIC_MAP_DEFAULT_PROVIDER,
  DYNAMIC_MAP_DEFAULT_RADIUS_KM,
  DYNAMIC_MAP_DEFAULT_RENDER_MODE,
  DYNAMIC_MAP_DEFAULT_RESULT_LIMIT,
  DYNAMIC_MAP_DEFAULT_ZOOM,
  DYNAMIC_MAP_PROVIDER_OPTIONS,
  DYNAMIC_MAP_RENDER_MODE_OPTIONS,
  loadNearbyPlacesSnapshot,
  normalizeNearbyPlacesRows,
  parseNearbyPlaces,
  type NearbyPlace,
  type NearbyPlacesFetchPolicy,
  type NearbyPlacesProvider,
} from './dynamic-map.shared';

function toNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function DynamicMapInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const provider = String(widget.props.provider ?? DYNAMIC_MAP_DEFAULT_PROVIDER) as NearbyPlacesProvider;
  const query = String(widget.props.providerPlaceQuery ?? '');
  const apiKey = String(widget.props.providerApiKey ?? '');
  const defaultCtaType = String(widget.props.ctaType ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE) as NearbyPlace['ctaType'];
  const defaultCtaLabel = String(widget.props.ctaLabel ?? DYNAMIC_MAP_DEFAULT_CTA_LABEL);
  const places = useMemo(() => parseNearbyPlaces(String(widget.props.markersCsv ?? '')), [widget.props.markersCsv]);

  const updateProps = (patch: Record<string, unknown>) => widgetActions.updateWidgetProps(widget.id, patch);

  const [showRawPlaces, setShowRawPlaces] = useState(false);

  const importPlacesFile = async (file: File | null) => {
    if (!file) return;
    let normalizedPlaces: NearbyPlace[] = [];
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
      const rows = firstSheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' }) : [];
      normalizedPlaces = normalizeNearbyPlacesRows(rows);
    } else {
      const text = await file.text();
      normalizedPlaces = parseNearbyPlaces(text);
    }
    if (!normalizedPlaces.length) {
      setSyncState('error');
      setSyncMessage('That spreadsheet did not contain valid places with lat/lng columns.');
      return;
    }
    updateProps({
      markersCsv: buildNearbyPlacesCsv(normalizedPlaces),
      syncedPlaceCount: normalizedPlaces.length,
      syncedPlacesAt: new Date().toISOString(),
    });
    setSyncState('success');
    setSyncMessage(`Imported ${normalizedPlaces.length} places from spreadsheet.`);
  };

  const syncGooglePlaces = async () => {
    if (provider !== 'google-places') return;
    if (!apiKey.trim() || !query.trim()) {
      setSyncState('error');
      setSyncMessage('Add a provider API key and a place query before syncing.');
      return;
    }
    setSyncState('syncing');
    setSyncMessage('Syncing places…');
    const snapshot = await loadNearbyPlacesSnapshot({
      provider,
      apiKey,
      query,
      latitude: toNumber(widget.props.latitude, DYNAMIC_MAP_DEFAULT_LATITUDE),
      longitude: toNumber(widget.props.longitude, DYNAMIC_MAP_DEFAULT_LONGITUDE),
      radiusKm: Math.max(1, toNumber(widget.props.radiusKm, DYNAMIC_MAP_DEFAULT_RADIUS_KM)),
      resultLimit: Math.max(1, Math.min(10, toNumber(widget.props.providerResultLimit, DYNAMIC_MAP_DEFAULT_RESULT_LIMIT))),
      fetchPolicy: String(widget.props.fetchPolicy ?? DYNAMIC_MAP_DEFAULT_FETCH_POLICY) as NearbyPlacesFetchPolicy,
      cacheTtlMs: Math.max(1000, toNumber(widget.props.cacheTtlMs, DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS)),
      defaultCtaType,
      defaultCtaLabel,
    });
    if (!snapshot?.places.length) {
      setSyncState('error');
      setSyncMessage('No places were returned for this query.');
      return;
    }
    updateProps({
      markersCsv: buildNearbyPlacesCsv(snapshot.places),
      syncedPlaceCount: snapshot.places.length,
      syncedPlacesAt: snapshot.fetchedAt,
    });
    setSyncState('success');
    setSyncMessage(`Synced ${snapshot.places.length} places into Places CSV.`);
  };

  return (
    <section className="section section-premium">
      <h3>Nearby locations</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => updateProps({ title: event.target.value })} />
        </div>
        <div>
          <label>Location label</label>
          <input value={String(widget.props.location ?? '')} onChange={(event) => updateProps({ location: event.target.value })} />
        </div>
        <div>
          <label>Pin label</label>
          <input value={String(widget.props.pinLabel ?? '')} onChange={(event) => updateProps({ pinLabel: event.target.value })} />
        </div>
        <div className="inspector-two-col-grid">
          <div>
            <label>Latitude</label>
            <input type="number" step="0.0001" value={String(widget.props.latitude ?? '')} onChange={(event) => updateProps({ latitude: Number(event.target.value) })} />
          </div>
          <div>
            <label>Longitude</label>
            <input type="number" step="0.0001" value={String(widget.props.longitude ?? '')} onChange={(event) => updateProps({ longitude: Number(event.target.value) })} />
          </div>
        </div>
        <div className="inspector-two-col-grid">
          <div>
            <label>Zoom</label>
            <input type="number" step="1" value={String(widget.props.zoom ?? DYNAMIC_MAP_DEFAULT_ZOOM)} onChange={(event) => updateProps({ zoom: Number(event.target.value) })} />
          </div>
          <div>
            <label>Radius km</label>
            <input type="number" step="1" value={String(widget.props.radiusKm ?? DYNAMIC_MAP_DEFAULT_RADIUS_KM)} onChange={(event) => updateProps({ radiusKm: Number(event.target.value) })} />
          </div>
        </div>
        <div className="inspector-two-col-grid">
          <div>
            <label>Provider</label>
            <select value={provider} onChange={(event) => updateProps({ provider: event.target.value })}>
              {DYNAMIC_MAP_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Render mode</label>
            <select value={String(widget.props.renderMode ?? DYNAMIC_MAP_DEFAULT_RENDER_MODE)} onChange={(event) => updateProps({ renderMode: event.target.value })}>
              {DYNAMIC_MAP_RENDER_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label>Map size %</label>
          <input
            type="range"
            min="35"
            max="85"
            step="1"
            value={String(widget.props.mapPaneRatio ?? 72)}
            onChange={(event) => updateProps({ mapPaneRatio: Number(event.target.value) })}
          />
          <small className="muted inspector-helper-copy">Controls how much space the map takes versus the cards.</small>
        </div>
        {String(widget.props.renderMode ?? DYNAMIC_MAP_DEFAULT_RENDER_MODE) === 'search-bar' ? (
          <>
            <div>
              <label>Hero image</label>
              <input value={String(widget.props.heroImage ?? '')} placeholder="https://..." onChange={(event) => updateProps({ heroImage: event.target.value })} />
            </div>
            <div>
              <label>Logo image</label>
              <input value={String(widget.props.logoImage ?? '')} placeholder="https://..." onChange={(event) => updateProps({ logoImage: event.target.value })} />
            </div>
            <div>
              <label>Headline</label>
              <input value={String(widget.props.headlineText ?? '')} onChange={(event) => updateProps({ headlineText: event.target.value })} />
            </div>
            <div>
              <label>Subheadline</label>
              <input value={String(widget.props.subheadlineText ?? '')} onChange={(event) => updateProps({ subheadlineText: event.target.value })} />
            </div>
            <div>
              <label>Search/info label</label>
              <input value={String(widget.props.infoLabelText ?? '')} onChange={(event) => updateProps({ infoLabelText: event.target.value })} />
            </div>
            <div>
              <label>Brand text</label>
              <input value={String(widget.props.brandText ?? '')} onChange={(event) => updateProps({ brandText: event.target.value })} />
            </div>
            <div>
              <label>Primary address</label>
              <input value={String(widget.props.primaryAddressText ?? '')} onChange={(event) => updateProps({ primaryAddressText: event.target.value })} />
            </div>
            <div>
              <label>Primary hours</label>
              <input value={String(widget.props.primaryHoursText ?? '')} onChange={(event) => updateProps({ primaryHoursText: event.target.value })} />
            </div>
            <div className="inspector-two-col-grid">
              <div>
                <label>Primary CTA</label>
                <input value={String(widget.props.ctaLabel ?? '')} onChange={(event) => updateProps({ ctaLabel: event.target.value })} />
              </div>
              <div>
                <label>Directions CTA</label>
                <input value={String(widget.props.directionsCtaLabel ?? '')} onChange={(event) => updateProps({ directionsCtaLabel: event.target.value })} />
              </div>
            </div>
            <div className="inspector-two-col-grid">
              <div>
                <label>Locate me label</label>
                <input value={String(widget.props.locateMeLabel ?? '')} onChange={(event) => updateProps({ locateMeLabel: event.target.value })} />
              </div>
              <div>
                <label>Nearby title</label>
                <input value={String(widget.props.nearbyTitleText ?? '')} onChange={(event) => updateProps({ nearbyTitleText: event.target.value })} />
              </div>
            </div>
            <div className="inspector-two-col-grid">
              <div>
                <label>Locating text</label>
                <input value={String(widget.props.locatingText ?? '')} onChange={(event) => updateProps({ locatingText: event.target.value })} />
              </div>
              <div>
                <label>Location found text</label>
                <input value={String(widget.props.locationFoundText ?? '')} onChange={(event) => updateProps({ locationFoundText: event.target.value })} />
              </div>
            </div>
            <div className="inspector-two-col-grid">
              <div>
                <label>Bottom background</label>
                <input type="color" value={String(widget.props.bottomBackgroundColor ?? '#ffffff')} onChange={(event) => updateProps({ bottomBackgroundColor: event.target.value })} />
              </div>
              <div>
                <label>Search background</label>
                <input type="color" value={String(widget.props.searchBackgroundColor ?? '#ffffff')} onChange={(event) => updateProps({ searchBackgroundColor: event.target.value })} />
              </div>
            </div>
            <div>
              <label>Hero overlay opacity</label>
              <input type="number" step="0.05" min="0" max="1" value={String(widget.props.heroOverlayOpacity ?? 0.45)} onChange={(event) => updateProps({ heroOverlayOpacity: Number(event.target.value) })} />
            </div>
          </>
        ) : null}
        <div>
          <label>Map theme</label>
          <input value={String(widget.props.mode ?? '')} onChange={(event) => updateProps({ mode: event.target.value })} />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.requestUserLocation ?? false)} onChange={(event) => updateProps({ requestUserLocation: event.target.checked })} />
          Request user location
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.sortByDistance ?? true)} onChange={(event) => updateProps({ sortByDistance: event.target.checked })} />
          Sort by distance
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.showOpenNow ?? true)} onChange={(event) => updateProps({ showOpenNow: event.target.checked })} />
          Show open now
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.showDistance ?? true)} onChange={(event) => updateProps({ showDistance: event.target.checked })} />
          Show distance
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.cardsAutoscroll ?? false)} onChange={(event) => updateProps({ cardsAutoscroll: event.target.checked })} />
          Auto-scroll locations
        </label>
        <div>
          <label>Auto-scroll interval ms</label>
          <input type="number" step="100" min="800" value={String(widget.props.cardsAutoscrollIntervalMs ?? 2200)} onChange={(event) => updateProps({ cardsAutoscrollIntervalMs: Number(event.target.value) })} />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={Boolean(widget.props.showRoute ?? false)} onChange={(event) => updateProps({ showRoute: event.target.checked })} />
          Show route
        </label>
        <div className="inspector-two-col-grid">
          <div>
            <label>Scrollbar thumb</label>
            <input type="color" value={String(widget.props.scrollbarThumbColor ?? '#ffffff')} onChange={(event) => updateProps({ scrollbarThumbColor: event.target.value })} />
          </div>
          <div>
            <label>Scrollbar track</label>
            <input type="color" value={String(widget.props.scrollbarTrackColor ?? '#dbeafe')} onChange={(event) => updateProps({ scrollbarTrackColor: event.target.value })} />
          </div>
        </div>
        <div className="inspector-two-col-grid">
          <div>
            <label>Default CTA</label>
            <select value={String(widget.props.ctaType ?? DYNAMIC_MAP_DEFAULT_CTA_TYPE)} onChange={(event) => updateProps({ ctaType: event.target.value })}>
              {DYNAMIC_MAP_CTA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label>CTA label</label>
            <input value={String(widget.props.ctaLabel ?? '')} onChange={(event) => updateProps({ ctaLabel: event.target.value })} />
          </div>
        </div>

        {provider === 'google-places' ? (
          <>
            <div>
              <label>Provider API key</label>
              <input type="password" value={apiKey} placeholder="AIza..." onChange={(event) => updateProps({ providerApiKey: event.target.value })} />
            </div>
            <div>
              <label>Place query</label>
              <input value={query} placeholder="Toyota service center" onChange={(event) => updateProps({ providerPlaceQuery: event.target.value })} />
            </div>
            <div className="inspector-two-col-grid">
              <div>
                <label>Fetch policy</label>
                <select value={String(widget.props.fetchPolicy ?? DYNAMIC_MAP_DEFAULT_FETCH_POLICY)} onChange={(event) => updateProps({ fetchPolicy: event.target.value })}>
                  <option value="cache-first">Cache first</option>
                  <option value="network-first">Network first</option>
                  <option value="cache-only">Cache only</option>
                </select>
              </div>
              <div>
                <label>Place limit</label>
                <input type="number" step="1" min="1" max="10" value={String(widget.props.providerResultLimit ?? DYNAMIC_MAP_DEFAULT_RESULT_LIMIT)} onChange={(event) => updateProps({ providerResultLimit: Number(event.target.value) })} />
              </div>
            </div>
            <div>
              <label>Cache TTL ms</label>
              <input type="number" step="1000" min="1000" value={String(widget.props.cacheTtlMs ?? DYNAMIC_MAP_DEFAULT_CACHE_TTL_MS)} onChange={(event) => updateProps({ cacheTtlMs: Number(event.target.value) })} />
            </div>
            <div className="field-stack">
              <Button size="sm" className="left-button compact-action inspector-emphasis-button" onClick={() => void syncGooglePlaces()} disabled={syncState === 'syncing'}>
                {syncState === 'syncing' ? 'Syncing…' : 'Sync places to CSV'}
              </Button>
              <small className="muted">{syncMessage || 'Sync live results into Places CSV so export stays stable.'}</small>
            </div>
          </>
        ) : null}

        <div>
          <label>Places file</label>
          <div className="field-stack inspector-spaced-stack">
            <label className="left-button compact-action inspector-emphasis-button inspector-upload-button">
              Upload Excel or CSV
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="inspector-hidden-input"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  void importPlacesFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <small className="muted">Upload a spreadsheet with columns like `name`, `lat`, `lng/long`, `address`, `badge`, `openNow`, `ctaLabel`, `ctaType`, `ctaUrl`.</small>
            <Button size="sm" className="left-button compact-action inspector-emphasis-button" onClick={() => setShowRawPlaces((value) => !value)}>
              {showRawPlaces ? 'Hide raw data' : 'Show raw data'}
            </Button>
          </div>
          <small className="muted">{places.length} normalized place{places.length === 1 ? '' : 's'} ready for export.</small>
          {showRawPlaces ? (
            <>
              <label className="inspector-spaced-label">Raw places data</label>
              <textarea rows={7} value={String(widget.props.markersCsv ?? '')} onChange={(event) => updateProps({ markersCsv: event.target.value })} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
