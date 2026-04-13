import { createModuleDefinition } from '../module-definition-factory';
import { renderWeatherConditionsStage } from '../weather-conditions.renderer';

export const WeatherConditionsDefinition = createModuleDefinition({
  type: 'weather-conditions',
  label: 'Weather Conditions',
  category: 'interactive',
  frame: { x: 80, y: 70, width: 280, height: 150, rotation: 0 },
  props: { title: 'Weather', condition: 'Cloudy', temperature: 24, location: 'San Salvador', latitude: 13.6929, longitude: -89.2182, provider: 'open-meteo', fetchPolicy: 'cache-first', cacheTtlMs: 300000, liveWeather: true },
  inspectorFields: [{ key: 'title' }, { key: 'location' }, { key: 'condition' }, { key: 'temperature', type: 'number' }, { key: 'provider' }, { key: 'fetchPolicy' }, { key: 'liveWeather', type: 'checkbox' }],
  style: { backgroundColor: '#f8fafc', accentColor: '#60a5fa', color: '#0f172a' },
  renderStage: renderWeatherConditionsStage,
});
