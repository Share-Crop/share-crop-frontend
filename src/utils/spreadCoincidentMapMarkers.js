/**
 * Spread markers that share the same (rounded) lat/lng into a small ring in meters
 * so each field keeps its own pin. True coordinates are unchanged in data — only display position shifts.
 */

const DEFAULT_PRECISION = 5;
const DEFAULT_BASE_RADIUS_M = 18;
const METERS_PER_DEG_LAT = 111320;

/** Web Mercator: meters per pixel at latitude for a given zoom (Mapbox/Google style). */
export function metersPerPixelAtLatitude(latDeg, zoom) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(zoom)) return null;
  const latRad = (latDeg * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);
}

function cellKey(lng, lat, precision) {
  return `${lng.toFixed(precision)},${lat.toFixed(precision)}`;
}

/** @param {number} dEastMeters @param {number} dNorthMeters @param {number} latDeg */
function metersToLngLatDelta(dEastMeters, dNorthMeters, latDeg) {
  const latRad = (latDeg * Math.PI) / 180;
  const cos = Math.cos(latRad);
  const denomLng = METERS_PER_DEG_LAT * (cos === 0 ? 1e-6 : cos);
  return [dEastMeters / denomLng, dNorthMeters / METERS_PER_DEG_LAT];
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => [number, number] | null} getLngLat
 * @param {(item: T, index: number) => string|number} getKey
 * @param {{ precision?: number, baseRadiusMeters?: number, zoom?: number, minRingRadiusPx?: number, maxSpreadRadiusMeters?: number }} [options]
 * @returns {Map<string, [number, number]>}
 */
export function buildCoincidentMarkerPositionMap(items, getLngLat, getKey, options = {}) {
  const precision = options.precision ?? DEFAULT_PRECISION;
  const baseRadiusMeters = options.baseRadiusMeters ?? DEFAULT_BASE_RADIUS_M;
  const mapZoom = options.zoom;
  const minRingRadiusPx = options.minRingRadiusPx ?? 26;
  const maxSpreadRadiusMeters = options.maxSpreadRadiusMeters ?? 150_000;

  /** @type {Map<string, { item: T, index: number, lng: number, lat: number }[]>} */
  const groups = new Map();

  items.forEach((item, index) => {
    const ll = getLngLat(item);
    if (!ll) return;
    const [lng, lat] = ll;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = cellKey(lng, lat, precision);
    const row = { item, index, lng, lat };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  /** @type {Map<string, [number, number]>} */
  const out = new Map();

  groups.forEach((rows) => {
    const sorted = [...rows].sort((a, b) => {
      const ka = String(getKey(a.item, a.index));
      const kb = String(getKey(b.item, b.index));
      return ka.localeCompare(kb, undefined, { numeric: true });
    });

    const n = sorted.length;
    const [centerLng, centerLat] = [sorted[0].lng, sorted[0].lat];

    if (n === 1) {
      const k = String(getKey(sorted[0].item, sorted[0].index));
      out.set(k, [centerLng, centerLat]);
      return;
    }

    const mpp = mapZoom != null && Number.isFinite(mapZoom)
      ? metersPerPixelAtLatitude(centerLat, mapZoom)
      : null;

    let radiusM = baseRadiusMeters + Math.max(0, n - 2) * 5;
    if (mpp != null && mpp > 0) {
      const pxRadius = minRingRadiusPx + Math.max(0, n - 2) * 5;
      radiusM = Math.max(radiusM, pxRadius * mpp);
    }
    radiusM = Math.min(radiusM, maxSpreadRadiusMeters);

    sorted.forEach((row, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const east = radiusM * Math.cos(angle);
      const north = radiusM * Math.sin(angle);
      const [dLng, dLat] = metersToLngLatDelta(east, north, centerLat);
      const k = String(getKey(row.item, row.index));
      out.set(k, [centerLng + dLng, centerLat + dLat]);
    });
  });

  return out;
}

export function getProductLngLat(product) {
  if (!product?.coordinates) return null;
  if (Array.isArray(product.coordinates)) {
    const lng = product.coordinates[0];
    const lat = product.coordinates[1];
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }
  if (typeof product.coordinates === 'object') {
    const lng = product.coordinates.lng ?? product.coordinates.longitude;
    const lat = product.coordinates.lat ?? product.coordinates.latitude;
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }
  return null;
}
