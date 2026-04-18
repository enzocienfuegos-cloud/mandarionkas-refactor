import { createModuleDefinition } from '../module-definition-factory';
import { renderDynamicMapStage } from '../dynamic-map.renderer';

export const DynamicMapDefinition = createModuleDefinition({
  type: 'dynamic-map',
  label: 'Dynamic Map',
  category: 'interactive',
  frame: { x: 100, y: 70, width: 220, height: 118, rotation: 0 },
  props: { title: 'Dynamic Map', location: 'San Salvador', radiusKm: 5, pinLabel: 'Store', latitude: 13.6929, longitude: -89.2182, zoom: 13, markersCsv: 'name,flag,lat,lng\nSan Salvador,SV,13.6929,-89.2182\nSanta Tecla,SV,13.6769,-89.2797', provider: 'osm' },
  inspectorFields: [
    { key: 'title' },
    { key: 'location' },
    { key: 'pinLabel', label: 'Pin label' },
    { key: 'latitude', type: 'number' },
    { key: 'longitude', type: 'number' },
    { key: 'zoom', type: 'number' },
    { key: 'radiusKm', label: 'Radius km', type: 'number' },
    { key: 'provider' },
    { key: 'mode' },
    { key: 'showRoute', label: 'Show route', type: 'checkbox' },
    { key: 'markersCsv', label: 'Markers CSV', type: 'textarea' },
  ],
  style: { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a' },
  renderStage: renderDynamicMapStage,
});
