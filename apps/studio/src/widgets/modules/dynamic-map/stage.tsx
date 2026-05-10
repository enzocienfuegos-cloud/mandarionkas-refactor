import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../../domain/document/types';
import type { RenderContext } from '../../../canvas/stage/render-context';
import { moduleBody } from '../shared-styles';
import type { DynamicMapPanelState } from './schema';
import type { UserGeoPosition } from './geolocation-state';
import type { DynamicMapViewModel, PlaceWithDistance } from './view-model';
import { buildPlaceCtaUrl, DYNAMIC_MAP_ACTION_LABELS } from './places-loader';
import {
  buildBadgeStyle,
  buildCardsListStyle,
  buildCompactCardBadgeStyle,
  buildCompactCardStyle,
  buildCompactExternalActionStyle,
  buildDirectionsButtonStyle,
  buildHeroImageWrapStyle,
  buildHeroLogoStyle,
  buildHeroOverlayStyle,
  buildLocateButtonInlineStyle,
  buildLocateButtonStyle,
  buildLocatorExternalActionStyle,
  buildLocatorIndexStyle,
  buildLocatorListItemStyle,
  buildLocatorListStyle,
  buildLocatorStatusDotStyle,
  buildMapCardStyle,
  buildModuleGridStyle,
  buildModuleHeaderRowStyle,
  buildPrimaryActionStyle,
  buildPrimaryPinStyle,
  buildSearchBarBottomPanelStyle,
  buildSearchBarShellStyle,
  buildSearchPanelHeaderStyle,
  buildSearchPanelMapStyle,
  buildSearchPillStyle,
  dynamicMapBrandPalette,
  dynamicMapUi,
  mapTooltipStyles,
} from './style-recipe';

type DivRef = { current: HTMLDivElement | null };

function LocateIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="2" />
      <path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DynamicMapSearchBarStage({
  node,
  ctx,
  shellStyle,
  accent,
  viewModel,
  panelOpen,
  onOpenPanel,
  onClosePanel,
  onSelectPlace,
  requestUserPosition,
  panelState,
  panelMapCanvasRef,
  searchListScrollRef,
  selectedPlace,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  shellStyle: CSSProperties;
  accent: string;
  viewModel: DynamicMapViewModel;
  panelOpen: boolean;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  onSelectPlace: (place: PlaceWithDistance) => void;
  requestUserPosition: () => void;
  panelState: DynamicMapPanelState;
  panelMapCanvasRef: DivRef;
  searchListScrollRef: DivRef;
  selectedPlace: PlaceWithDistance | null;
}): JSX.Element {
  const { resolved, nearestPlaces, listedPlaces } = viewModel;
  const searchBarBottomPanelStyle = buildSearchBarBottomPanelStyle(viewModel.bottomHeight, resolved.bottomBackgroundColor);
  const searchPillStyle = buildSearchPillStyle(resolved.searchBackgroundColor);
  const primaryPinStyle = buildPrimaryPinStyle(accent);
  const primaryActionStyle = buildPrimaryActionStyle(accent);
  const searchPanelHeaderStyle = buildSearchPanelHeaderStyle(accent);
  const locateButtonStyle = buildLocateButtonStyle(accent);
  const locatorStatusDotStyle = buildLocatorStatusDotStyle(accent);
  const directionsButtonStyle = buildDirectionsButtonStyle(accent);
  const locatorListStyle = buildLocatorListStyle(resolved.scrollbarThumbColor, resolved.scrollbarTrackColor);

  return (
    <div style={buildSearchBarShellStyle(node, ctx, shellStyle)}>
      <style>{mapTooltipStyles}</style>
      <div style={dynamicMapUi.searchBarBaseLayerStyle}>
        <div style={buildHeroImageWrapStyle(viewModel.heroHeight, resolved.heroImage)}>
          {resolved.heroImage ? <img src={resolved.heroImage} alt={resolved.headlineText} style={dynamicMapUi.mediaFillStyle} /> : null}
          <div style={buildHeroOverlayStyle(resolved.heroOverlayOpacity)} />
          {resolved.logoImage ? <img src={resolved.logoImage} alt={resolved.brandText} style={buildHeroLogoStyle()} /> : null}
          <div style={dynamicMapUi.searchBarHeadlineWrapStyle}>
            <div style={dynamicMapUi.searchBarHeadlineStyle}>{resolved.headlineText}</div>
            <div style={dynamicMapUi.searchBarSubheadlineStyle}>{resolved.subheadlineText}</div>
          </div>
        </div>

        <div style={searchBarBottomPanelStyle}>
          <div style={dynamicMapUi.searchBarInfoRowStyle}>
            <div style={searchPillStyle}>
              <span style={dynamicMapUi.searchBarSearchIconStyle}>⌕</span>
              <span style={dynamicMapUi.searchBarSearchLabelStyle}>{resolved.infoLabelText}</span>
            </div>
          </div>
          <div style={dynamicMapUi.searchBarLocationRowStyle}>
            <div style={primaryPinStyle}>⌖</div>
            <div style={dynamicMapUi.searchBarPrimaryMetaStyle}>
              <div style={dynamicMapUi.searchBarBrandStyle}>{resolved.brandText}</div>
              <div style={dynamicMapUi.searchBarPrimaryAddressStyle}>{resolved.primaryAddressText}</div>
              <div style={dynamicMapUi.searchBarPrimaryHoursStyle}>{resolved.primaryHoursText}</div>
            </div>
          </div>
          <div style={dynamicMapUi.actionRowStyle}>
            <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPanel(); }} style={primaryActionStyle}>
              {resolved.defaultCtaLabel}
            </button>
          </div>
        </div>

        {panelOpen ? (
          <div style={dynamicMapUi.searchPanelRootStyle}>
            <div style={searchPanelHeaderStyle}>
              {resolved.logoImage ? <img src={resolved.logoImage} alt={resolved.brandText} style={dynamicMapUi.searchPanelLogoStyle} /> : null}
              <div style={dynamicMapUi.searchPanelTitleStyle}>{resolved.brandText}</div>
              <button type="button" onClick={(event) => { event.stopPropagation(); onClosePanel(); }} style={dynamicMapUi.searchPanelCloseStyle}>×</button>
            </div>
            <div style={buildSearchPanelMapStyle(viewModel.mapBackground)}>
              {!viewModel.cardsOnly ? <div ref={panelMapCanvasRef} style={dynamicMapUi.fillAbsoluteStyle} /> : null}
              <button type="button" aria-label={resolved.locateMeLabel} title={resolved.locateMeLabel} onClick={(event) => { event.stopPropagation(); requestUserPosition(); }} style={locateButtonStyle}>
                <LocateIcon size={18} color={accent} />
              </button>
            </div>
            <div style={dynamicMapUi.searchPanelFooterBaseStyle}>
              <div style={dynamicMapUi.locatorStatusRowStyle}>
                <div style={locatorStatusDotStyle} />
                <div style={dynamicMapUi.locatorStatusBodyStyle}>
                  <div style={dynamicMapUi.locatorStatusTitleStyle}>
                    {panelState === 'locating' ? resolved.locatingText : panelState === 'located' ? resolved.locationFoundText : resolved.infoLabelText}
                  </div>
                  <div style={dynamicMapUi.locatorStatusDetailStyle}>
                    {panelState === 'located' ? resolved.nearbyTitleText : <><b>{resolved.primaryAddressText}</b><br />{resolved.primaryHoursText}</>}
                  </div>
                </div>
                <button type="button" onClick={(event) => { event.stopPropagation(); if (nearestPlaces[0]) window.open(buildPlaceCtaUrl(nearestPlaces[0], 'maps'), '_blank'); }} style={directionsButtonStyle}>
                  {resolved.directionsCtaLabel}
                </button>
              </div>
              <div ref={searchListScrollRef} className="smx-locator-scroll" style={locatorListStyle}>
                <div style={dynamicMapUi.locatorListHeadingStyle}>{resolved.nearbyTitleText}</div>
                {listedPlaces.map((place, index) => {
                  const selected = Boolean(selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng);
                  return (
                    <div key={`${place.name}-${index}-nearest`} onClick={() => onSelectPlace(place)} style={buildLocatorListItemStyle(selected, accent)}>
                      <div style={buildLocatorIndexStyle(accent)}>{index + 1}</div>
                      <div style={dynamicMapUi.locatorListTextWrapStyle}>
                        <div style={dynamicMapUi.locatorListTitleStyle}>{place.name}</div>
                        <div style={dynamicMapUi.locatorListMetaStyle}>
                          <span>{place.address || resolved.primaryHoursText}</span>
                          {place.badge ? <span style={buildBadgeStyle(accent)}>{place.badge}</span> : null}
                        </div>
                      </div>
                      <div style={dynamicMapUi.locatorActionGroupStyle}>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={buildLocatorExternalActionStyle(dynamicMapBrandPalette.wazeBlue)}>{DYNAMIC_MAP_ACTION_LABELS.waze}</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={buildLocatorExternalActionStyle(dynamicMapBrandPalette.mapsBlue)}>{DYNAMIC_MAP_ACTION_LABELS.maps}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DynamicMapStandardStage({
  node,
  ctx,
  shellStyle,
  accent,
  viewModel,
  providerStatus,
  userPosition,
  onSelectPlace,
  requestUserPosition,
  mapCanvasRef,
  cardsListRef,
  selectedPlace,
}: {
  node: WidgetNode;
  ctx: RenderContext;
  shellStyle: CSSProperties;
  accent: string;
  viewModel: DynamicMapViewModel;
  providerStatus: 'idle' | 'loading' | 'live' | 'error';
  userPosition: UserGeoPosition | null;
  onSelectPlace: (place: PlaceWithDistance) => void;
  requestUserPosition: () => void;
  mapCanvasRef: DivRef;
  cardsListRef: DivRef;
  selectedPlace: PlaceWithDistance | null;
}): JSX.Element {
  const { resolved, places } = viewModel;

  return (
    <div style={shellStyle}>
      <style>{mapTooltipStyles}</style>
      <div style={buildModuleHeaderRowStyle(node)}>
        <span>{resolved.title}</span>
      </div>
      <div style={moduleBody}>
        <div style={buildModuleGridStyle(viewModel.gridTemplateColumns, viewModel.gridTemplateRows)}>
          {!viewModel.cardsOnly ? (
            <div style={buildMapCardStyle(viewModel.stackedLayout, viewModel.mapBackground)}>
              <div ref={mapCanvasRef} style={dynamicMapUi.fillAbsoluteStyle} />
              {resolved.requestUserLocation ? (
                <button
                  type="button"
                  aria-label={resolved.locateMeLabel}
                  title={resolved.locateMeLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestUserPosition();
                  }}
                  style={buildLocateButtonInlineStyle(buildLocateButtonStyle(accent))}
                >
                  <LocateIcon size={18} color={accent} />
                </button>
              ) : null}
              <div style={dynamicMapUi.mapStatusPillRowStyle}>
                <span>{places.length} locations · zoom {resolved.zoom}</span>
                <span>{providerStatus === 'loading' ? 'Syncing locations' : providerStatus === 'error' ? 'Places unavailable' : userPosition ? 'Location ready' : resolved.requestUserLocation ? 'Tap to locate' : 'Location fixed'}</span>
              </div>
            </div>
          ) : null}
          <div ref={cardsListRef} className="smx-locator-scroll" style={buildCardsListStyle(resolved.scrollbarThumbColor, resolved.scrollbarTrackColor)}>
            {places.map((place, index) => {
              const selected = Boolean(selectedPlace?.name === place.name && selectedPlace?.lat === place.lat && selectedPlace?.lng === place.lng);
              return (
                <div key={`${place.name}-${index}-card`} onClick={() => onSelectPlace(place)} style={buildCompactCardStyle(selected, accent)}>
                  <div style={dynamicMapUi.compactCardHeaderStyle}>
                    <strong style={dynamicMapUi.compactCardTitleStyle}>{place.name}</strong>
                    <span style={buildCompactCardBadgeStyle(accent)}>{place.badge || (place.openNow ? 'Open now' : 'Store')}</span>
                  </div>
                  <div style={dynamicMapUi.compactCardAddressStyle}>{place.address || `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`}</div>
                  <div style={dynamicMapUi.compactCardMetaRowStyle}>
                    {resolved.showOpenNow && place.openNow != null ? <span>{place.openNow ? 'Open now' : 'Closed'}</span> : null}
                    {resolved.showDistance && place.distanceKm != null ? <span>{place.distanceKm.toFixed(1)} km</span> : null}
                  </div>
                  <div style={dynamicMapUi.compactCardActionsStyle}>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'waze'), '_blank'); }} style={buildCompactExternalActionStyle(dynamicMapBrandPalette.wazeBlue)}>
                      {DYNAMIC_MAP_ACTION_LABELS.waze}
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); ctx.triggerWidgetAction('click'); if (ctx.previewMode) window.open(buildPlaceCtaUrl(place, 'maps'), '_blank'); }} style={buildCompactExternalActionStyle(dynamicMapBrandPalette.mapsBlue)}>
                      {DYNAMIC_MAP_ACTION_LABELS.maps}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
