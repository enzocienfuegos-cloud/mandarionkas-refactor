import { useEffect, useMemo, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { loadWeatherSnapshot, resolveWeatherIcon, type WeatherSnapshot } from './weather-conditions.shared';

function WeatherModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const fallbackLocation = String(node.props.location ?? 'Location');
  const fallbackCondition = String(node.props.condition ?? 'Sunny');
  const fallbackTemperature = Number(node.props.temperature ?? 28);
  const liveWeather = Boolean(node.props.liveWeather ?? true);
  const provider = String(node.props.provider ?? 'open-meteo') as 'open-meteo' | 'static';
  const fetchPolicy = String(node.props.fetchPolicy ?? 'cache-first') as 'cache-first' | 'network-first' | 'cache-only';
  const cacheTtlMs = Math.max(1000, Number(node.props.cacheTtlMs ?? 300000));
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    if (!liveWeather || provider !== 'open-meteo' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void loadWeatherSnapshot({
      provider,
      latitude,
      longitude,
      location: fallbackLocation,
      fetchPolicy,
      cacheTtlMs,
    }).then((nextSnapshot) => {
      if (!cancelled) setSnapshot(nextSnapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [liveWeather, provider, latitude, longitude, fallbackLocation, fetchPolicy, cacheTtlMs]);

  const location = snapshot?.location ?? fallbackLocation;
  const condition = snapshot?.condition ?? fallbackCondition;
  const temperature = snapshot?.temperature ?? fallbackTemperature;
  const isDay = snapshot?.isDay ?? true;
  const icon = useMemo(() => resolveWeatherIcon(condition, isDay), [condition, isDay]);
  const status = snapshot ? 'Live weather' : liveWeather && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview';

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{temperature}°</div>
            <div style={{ fontSize: 12, opacity: 0.78 }}>{location}</div>
          </div>
          <div style={{ fontSize: 34 }}>{icon}</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 10, background: `${accent}22`, fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{condition}</span>
          <span style={{ opacity: 0.74 }}>{status}</span>
        </div>
      </div>
    </div>
  );
}

export function renderWeatherConditionsStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <WeatherModuleRenderer node={node} ctx={ctx} />;
}
