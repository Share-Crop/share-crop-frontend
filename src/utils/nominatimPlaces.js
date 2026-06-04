import { normalizeIso2 } from './shippingDestinations';
import { resolveCityName } from './resolveCityName';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ShareCrop-DeliveryAddress/1.0 (contact: support@sharecrop.app)';

/**
 * OpenStreetMap forward search — strong coverage for universities and landmarks
 * where Mapbox POI data is sparse (e.g. Pakistan).
 */
export async function searchNominatimPlaces(query, options = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const { countryCode, limit = 8 } = options;
  try {
    const params = new URLSearchParams({
      q,
      format: 'json',
      addressdetails: '1',
      limit: String(Math.min(limit, 10)),
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('countrycodes', cc.toLowerCase());
    const url = `${NOMINATIM_BASE}?${params}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    return rows.map(nominatimRowToGeocodingFeature).filter(Boolean);
  } catch {
    return [];
  }
}

function nominatimRowToGeocodingFeature(row) {
  if (!row) return null;
  const addr = row.address || {};
  const displayName = String(row.display_name || '').trim();
  const city = resolveCityName({
    place: addr.city || addr.town || addr.village || '',
    locality: addr.suburb || addr.neighbourhood || addr.quarter || '',
    district: addr.district || addr.state_district || addr.county || '',
    division: addr.historical_division || '',
    placeName: displayName,
    suburb: addr.suburb || '',
  }) || addr.town || addr.municipality || '';
  const state = addr.state || addr.region || '';
  const country = addr.country || '';
  const countryCode = normalizeIso2(addr.country_code);
  const postcode = addr.postcode || '';
  const road = addr.road || addr.pedestrian || addr.footway || '';
  const house = addr.house_number || '';
  const line1 = String(row.name || '').trim()
    || [house, road].filter(Boolean).join(' ').trim()
    || String(row.display_name || '').split(',')[0].trim();
  const context = [];
  if (country) {
    context.push({
      id: 'country.nominatim',
      text: country,
      short_code: countryCode ? countryCode.toLowerCase() : undefined,
    });
  }
  if (state) {
    context.push({ id: 'region.nominatim', text: state });
  }
  if (postcode) {
    context.push({ id: 'postcode.nominatim', text: postcode });
  }
  if (city) {
    context.push({ id: 'place.nominatim', text: city });
  }
  if (road) {
    context.push({
      id: 'address.nominatim',
      text: [house, road].filter(Boolean).join(' ').trim(),
    });
  }
  const osmType = String(row.type || row.class || '').toLowerCase();
  const featureType =
    osmType === 'university' || osmType === 'college' || osmType === 'school'
      ? 'poi'
      : osmType === 'house' || osmType === 'building' || road
        ? 'address'
        : osmType === 'road' || osmType === 'residential'
          ? 'street'
          : 'place';

  const lon = Number(row.lon);
  const lat = Number(row.lat);
  return {
    id: `nominatim.${row.osm_type || 'node'}.${row.osm_id || row.place_id || ''}`,
    type: 'Feature',
    text: line1,
    place_name: displayName || line1,
    address: house || undefined,
    center: Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : undefined,
    context,
    properties: {
      feature_type: featureType,
      osm_type: osmType,
      source: 'nominatim',
      resolved_city: city,
      historical_division: addr.historical_division || '',
      poi_category: featureType === 'poi' ? [osmType] : undefined,
    },
  };
}
