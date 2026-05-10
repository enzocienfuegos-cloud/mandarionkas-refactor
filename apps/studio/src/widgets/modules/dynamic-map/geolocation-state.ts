import { useEffect, useState } from 'react';
import type { DynamicMapPanelState } from './schema';

export type UserGeoPosition = { latitude: number; longitude: number };

function readCurrentPosition(
  onSuccess: (position: UserGeoPosition) => void,
  onError: () => void,
): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError();
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    onSuccess({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  }, onError, { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
}

export function useDynamicMapGeolocation(options: {
  previewMode: boolean;
  autoRequest: boolean;
}): {
  userPosition: UserGeoPosition | null;
  panelState: DynamicMapPanelState;
  requestUserPosition: () => void;
} {
  const [userPosition, setUserPosition] = useState<UserGeoPosition | null>(null);
  const [panelState, setPanelState] = useState<DynamicMapPanelState>('default');

  useEffect(() => {
    if (!options.previewMode || !options.autoRequest) return;
    let cancelled = false;
    readCurrentPosition((position) => {
      if (!cancelled) setUserPosition(position);
    }, () => {
      if (!cancelled) setUserPosition(null);
    });
    return () => {
      cancelled = true;
    };
  }, [options.autoRequest, options.previewMode]);

  function requestUserPosition(): void {
    setPanelState('locating');
    readCurrentPosition((position) => {
      setUserPosition(position);
      setPanelState('located');
    }, () => {
      setPanelState('default');
    });
  }

  return {
    userPosition,
    panelState,
    requestUserPosition,
  };
}
