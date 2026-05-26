import { normalizeIso2 } from './shippingDestinations';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

/**
 * Forward geocode cities/places (Mapbox Geocoding API).
 * @param {string} query
 * @param {{ countryCode?: string, limit?: number }} options
 */
export async function searchMapboxPlaces(query, options = {}) {
  const q = String(query || '').trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  const { countryCode, limit = 8 } = options;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'place,locality,district',
      limit: String(limit),
      language: 'en',
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('country', cc.toLowerCase());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.features) ? data.features : [];
  } catch {
    return [];
  }
}

/**
 * Parse Mapbox Geocoding feature → shipping city row for forms / API.
 */
export function mapboxFeatureToShippingCityRow(feature, fallbackCountryCode = '') {
  if (!feature || typeof feature !== 'object') return null;
  const ctx = Array.isArray(feature.context) ? feature.context : [];
  let countryCode = normalizeIso2(fallbackCountryCode);
  let region = '';
  let regionCode = '';
  for (const c of ctx) {
    const id = String(c.id || '');
    if (id.startsWith('country.')) {
      countryCode = normalizeIso2(c.short_code) || countryCode;
    } else if (id.startsWith('region.')) {
      region = String(c.text || '').trim();
      regionCode = String(c.short_code || '').trim();
    }
  }
  const city = String(feature.text || '').trim();
  if (!city) return null;
  const center = Array.isArray(feature.center) && feature.center.length >= 2
    ? [Number(feature.center[0]), Number(feature.center[1])]
    : null;
  const label = String(feature.place_name || city).trim();
  return {
    countryCode: countryCode || normalizeIso2(fallbackCountryCode),
    city: city.slice(0, 120),
    region: region.slice(0, 120),
    regionCode: regionCode.slice(0, 20),
    mapboxId: String(feature.id || '').slice(0, 120),
    label: label.slice(0, 200),
    center,
  };
}

/** Build Autocomplete value object from a saved shipping city row. */
export function shippingCityRowToOption(row) {
  if (!row || !row.city) return null;
  const label =
    row.label ||
    (row.region ? `${row.city}, ${row.region}` : row.city);
  return {
    ...row,
    label,
    place_name: label,
    id: row.mapboxId || `legacy:${row.countryCode}:${row.city}:${row.region || ''}`,
  };
}
