// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { loadWeatherSnapshot, resolveWeatherIcon, type WeatherSnapshot } from './weather-conditions.shared';

const weatherSummaryRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const weatherTemperatureStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
};

const weatherLocationStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.78,
};

const weatherIconStyle: CSSProperties = {
  fontSize: 34,
};

const weatherStatusBaseStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 10,
  fontSize: 12,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
};

const weatherStatusMetaStyle: CSSProperties = {
  opacity: 0.74,
};

function buildWeatherStatusStyle(accent: string): CSSProperties {
  return {
    ...weatherStatusBaseStyle,
    background: `${accent}22`,
  };
}

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
        <div style={weatherSummaryRowStyle}>
          <div>
            <div style={weatherTemperatureStyle}>{temperature}°</div>
            <div style={weatherLocationStyle}>{location}</div>
          </div>
          <div style={weatherIconStyle}>{icon}</div>
        </div>
        <div style={buildWeatherStatusStyle(accent)}>
          <span>{condition}</span>
          <span style={weatherStatusMetaStyle}>{status}</span>
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
