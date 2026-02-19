/**
 * Google Maps 2D with OpenWeatherMap tile overlays.
 * Use this when weather layers are enabled - 2D map supports overlays reliably.
 * Requires: REACT_APP_GOOGLE_MAPS_API_KEY, REACT_APP_OPENWEATHER_API_KEY
 */
import React, { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { WEATHER_LEGEND_DATA } from './weatherLegendData';
import { Block, CloudQueue, Grain, DeviceThermostat, Compress, Air } from '@mui/icons-material';

const SCRIPT_ID = 'google-maps-2d-script';
const OWM_LAYERS = [
  { id: 'none', label: 'None', Icon: Block },
  { id: 'clouds_new', label: 'Clouds', Icon: CloudQueue },
  { id: 'precipitation_new', label: 'Precipitation', Icon: Grain },
  { id: 'temp_new', label: 'Temperature', Icon: DeviceThermostat },
  { id: 'pressure_new', label: 'Pressure', Icon: Compress },
  { id: 'wind_new', label: 'Wind', Icon: Air },
];

function loadGoogleMapsScript(apiKey) {
  if (typeof window === 'undefined' || !apiKey) return Promise.reject(new Error('No API key'));
  if (window.google?.maps?.Map) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID);
  if (existing) {
    return new Promise((resolve) => {
      const check = () => {
        if (window.google?.maps?.Map) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }

  return new Promise((resolve, reject) => {
    const cb = `__googleMaps2DCb_${Date.now()}`;
    window[cb] = () => {
      delete window[cb];
      resolve();
    };
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${cb}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

const GoogleMap2DWithWeather = forwardRef(function GoogleMap2DWithWeather({
  latitude,
  longitude,
  zoom,
  onViewChange,
  farms = [],
  onMarkerClick,
  getMarkerSvg,
  isMobile = false,
  iconDataUrlCache = {},
  style = {},
}, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const overlayRef = useRef(null);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  const [activeLayer, setActiveLayer] = useState('clouds_new');
  const [mapReady, setMapReady] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const owmKey = process.env.REACT_APP_OPENWEATHER_API_KEY;

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    flyTo: (params) => {
      const map = mapRef.current;
      if (!map) return;
      const center = params?.center;
      const z = params?.zoom ?? 8;
      if (Array.isArray(center) && center.length >= 2) {
        map.panTo({ lat: center[1], lng: center[0] });
        map.setZoom(z);
      }
    },
  }), []);

  // Create OpenWeatherMap ImageMapType
  const createOverlay = useCallback((layerId) => {
    if (!owmKey || !window.google?.maps || layerId === 'none') return null;
    return new window.google.maps.ImageMapType({
      getTileUrl: (coord, z) => {
        const x = coord.x;
        const y = coord.y;
        return `https://tile.openweathermap.org/map/${layerId}/${z}/${x}/${y}.png?appid=${owmKey}`;
      },
      tileSize: new window.google.maps.Size(256, 256),
      maxZoom: 18,
      minZoom: 0,
      name: `OWM ${layerId}`,
    });
  }, [owmKey]);

  // Initialize map once for this component instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !apiKey) return;

    let cancelled = false;
    setMapReady(false);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !container) return;
        const map = new window.google.maps.Map(container, {
          center: { lat: latitude, lng: longitude },
          zoom: Math.round(zoom),
          mapTypeId: 'hybrid',
          mapTypeControl: false, // hide Map / Satellite toggle for cleaner weather UX
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          scaleControl: false,
          rotateControl: true,
        });

        mapRef.current = map;

        map.addListener('center_changed', () => {
          const c = map.getCenter();
          const z = map.getZoom();
          if (c && typeof onViewChangeRef.current === 'function') {
            onViewChangeRef.current({
              latitude: c.lat(),
              longitude: c.lng(),
              zoom: z,
            });
          }
        });
        map.addListener('zoom_changed', () => {
          const c = map.getCenter();
          const z = map.getZoom();
          if (c && typeof onViewChangeRef.current === 'function') {
            onViewChangeRef.current({
              latitude: c.lat(),
              longitude: c.lng(),
              zoom: z,
            });
          }
        });

        setMapReady(true);
      })
      .catch((err) => console.warn('[GoogleMap2D] Failed to load:', err));

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current = null;
      }
      setMapReady(false);
    };
  // Intentionally omit latitude/longitude/zoom: init once with current view, then let user pan/zoom
  // without recreating the map (recreating on every viewState change causes abrupt jumps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Sync overlay when activeLayer or map changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove existing overlay
    try {
      const arr = map.overlayMapTypes;
      if (arr && typeof arr.getLength === 'function' && arr.getLength() > 0) {
        arr.removeAt(0);
      }
    } catch (_) { /* ignore */ }
    overlayRef.current = null;

    if (owmKey) {
      const overlay = createOverlay(activeLayer);
      if (overlay) {
        map.overlayMapTypes.push(overlay);
        overlayRef.current = overlay;
      }
    }

    return () => {
      try {
        const arr = map?.overlayMapTypes;
        if (arr && typeof arr.getLength === 'function' && arr.getLength() > 0) {
          arr.removeAt(0);
        }
      } catch (_) { /* ignore */ }
      overlayRef.current = null;
    };
  }, [mapReady, activeLayer, owmKey, createOverlay]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !Array.isArray(farms) || farms.length === 0) return;

    const getSvg = typeof getMarkerSvg === 'function' ? getMarkerSvg : () => null;
    const onClick = typeof onMarkerClick === 'function' ? onMarkerClick : () => {};
    const list = markersRef.current;

    list.forEach((m) => {
      try {
        m.setMap(null);
      } catch (_) { /* ignore */ }
    });
    list.length = 0;

    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    farms.forEach((farm) => {
      let lat, lng;
      if (Array.isArray(farm.coordinates) && farm.coordinates.length >= 2) {
        lng = farm.coordinates[0];
        lat = farm.coordinates[1];
      } else if (farm.coordinates && typeof farm.coordinates === 'object') {
        lat = farm.coordinates.lat ?? farm.coordinates.latitude;
        lng = farm.coordinates.lng ?? farm.coordinates.longitude;
      } else return;
      if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const svgString = getSvg(farm, isMobile, iconDataUrlCache);
      const icon = svgString && parser
        ? { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString), scaledSize: new window.google.maps.Size(36, 36) }
        : undefined;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        icon,
        title: farm.name || farm.product_name || 'Field',
      });
      marker.addListener('click', () => onClick(farm));
      list.push(marker);
    });

    return () => {
      list.forEach((m) => {
        try {
          m.setMap(null);
        } catch (_) { /* ignore */ }
      });
      list.length = 0;
    };
  }, [mapReady, farms, onMarkerClick, getMarkerSvg, isMobile, iconDataUrlCache]);

  const legendConfig = activeLayer && activeLayer !== 'none' ? WEATHER_LEGEND_DATA[activeLayer] : null;
  const gradientCss = legendConfig && legendConfig.stops.length >= 2
    ? (() => {
        const min = legendConfig.stops[0].value;
        const max = legendConfig.stops[legendConfig.stops.length - 1].value;
        const range = max - min || 1;
        const parts = legendConfig.stops.map((s) => `${s.color} ${((s.value - min) / range) * 100}%`).join(', ');
        return `linear-gradient(to right, ${parts})`;
      })()
    : null;

  if (!apiKey) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Map legend for selected layer – gradient + labels */}
      {owmKey && mapReady && legendConfig && gradientCss && (
        <div
          style={{
            position: 'absolute',
            // Desktop: sit above default zoom controls; Mobile: up near top-right
            bottom: !isMobile ? '72px' : 'auto',
            top: isMobile ? '70px' : 'auto',
            right: isMobile ? '12px' : '16px',
            zIndex: 1000,
            background: 'rgba(10,10,16,0.96)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            minWidth: '180px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            {legendConfig.title}
          </div>
          <div
            style={{
              height: '14px',
              borderRadius: '6px',
              background: gradientCss,
              marginBottom: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.85)' }}>
            <span>{legendConfig.stops[0].value}{legendConfig.unit}</span>
            <span>{legendConfig.stops[legendConfig.stops.length - 1].value}{legendConfig.unit}</span>
          </div>
        </div>
      )}

      {/* Weather layer selector – on mobile sit above the bottom crop/progress bar */}
      {owmKey && mapReady && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '100px' : '16px',
            left: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setLayerPanelOpen((p) => !p)}
            style={{
              background: 'rgba(15,15,20,0.9)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            🌤️ Weather layers {layerPanelOpen ? '▼' : '▶'}
          </button>
          {layerPanelOpen && (
            <div
              style={{
                background: 'rgba(10,10,16,0.96)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '160px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              {OWM_LAYERS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setActiveLayer(l.id);
                  }}
                  style={{
                    background: activeLayer === l.id ? 'rgba(76, 175, 80, 0.4)' : 'transparent',
                    color: '#fff',
                    border: activeLayer === l.id ? '1px solid #4CAF50' : '1px solid transparent',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {l.Icon && <l.Icon sx={{ fontSize: 16 }} />}
                  {l.label}
                </button>
              ))}
              
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default GoogleMap2DWithWeather;
