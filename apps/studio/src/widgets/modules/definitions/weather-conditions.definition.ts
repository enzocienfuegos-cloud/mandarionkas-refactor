import { createModuleDefinition } from '../module-definition-factory';
import { renderWeatherConditionsExport } from '../weather-conditions.export';
import { renderWeatherConditionsStage } from '../weather-conditions.renderer';
import { WeatherConditionsThumb } from '../../registry/widget-thumbnails';

export const WeatherConditionsDefinition = createModuleDefinition({
  type: 'weather-conditions',
  label: 'Weather Conditions',
  category: 'interactive',
  thumbnail: WeatherConditionsThumb,
  frame: { x: 80, y: 70, width: 280, height: 150, rotation: 0 },
  props: { title: 'Weather', condition: 'Cloudy', temperature: 24, location: 'San Salvador', latitude: 13.6929, longitude: -89.2182, provider: 'open-meteo', fetchPolicy: 'cache-first', cacheTtlMs: 300000, liveWeather: true },
  inspectorFields: [
    { key: 'title' },
    { key: 'location' },
    { key: 'condition' },
    { key: 'temperature', type: 'number' },
    { key: 'latitude', label: 'Latitude', type: 'number' },
    { key: 'longitude', label: 'Longitude', type: 'number' },
    {
      key: 'provider',
      type: 'select',
      options: [
        { label: 'Open-Meteo', value: 'open-meteo' },
        { label: 'Static', value: 'static' },
      ],
    },
    {
      key: 'fetchPolicy',
      label: 'Fetch policy',
      type: 'select',
      options: [
        { label: 'Cache first', value: 'cache-first' },
        { label: 'Network first', value: 'network-first' },
        { label: 'Cache only', value: 'cache-only' },
      ],
    },
    { key: 'cacheTtlMs', label: 'Cache TTL ms', type: 'number' },
    { key: 'liveWeather', type: 'checkbox' },
  ],
  style: { backgroundColor: '#f8fafc', accentColor: '#60a5fa', color: '#0f172a' },
  capabilities: {
    performsNetworkIo: true,
    worksOffline: false,
    hasRuntimeRandomness: true,
  },
  renderStage: renderWeatherConditionsStage,
  renderExport: (node) => renderWeatherConditionsExport(node),
});
