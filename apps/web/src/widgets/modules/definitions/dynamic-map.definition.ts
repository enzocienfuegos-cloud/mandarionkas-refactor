import { createModuleDefinition } from '../module-definition-factory';
import { renderDynamicMapStage } from '../dynamic-map.renderer';
import { DynamicMapInspector } from '../dynamic-map.inspector';

export const DynamicMapDefinition = createModuleDefinition({
  type: 'dynamic-map',
  label: 'Dynamic Map',
  category: 'interactive',
  frame: { x: 100, y: 70, width: 320, height: 180, rotation: 0 },
  props: {
    title: 'Nearby Locations',
    location: 'San Salvador',
    radiusKm: 5,
    pinLabel: 'Store',
    latitude: 13.6929,
    longitude: -89.2182,
    zoom: 13,
    provider: 'manual',
    renderMode: 'cards-map',
    requestUserLocation: false,
    sortByDistance: true,
    showOpenNow: true,
    showDistance: true,
    ctaType: 'maps',
    ctaLabel: 'Open in Maps',
    providerApiKey: '',
    markersCsv: 'name,flag,lat,lng,address,badge,openNow,ctaLabel,ctaType,ctaUrl\nSan Salvador,SV,13.6929,-89.2182,Centro Comercial,Open now,true,Open in Maps,maps,\nSanta Tecla,SV,13.6769,-89.2797,Plaza Merliot,Drive-thru,false,Open in Waze,waze,',
    providerPlaceQuery: '',
    providerResultLimit: 5,
    fetchPolicy: 'network-first',
    cacheTtlMs: 300000,
  },
  style: { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a' },
  renderStage: renderDynamicMapStage,
  renderInspector: DynamicMapInspector,
});
