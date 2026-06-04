import { normalizeIso2 } from './shippingDestinations';
import { searchNominatimPlaces } from './nominatimPlaces';
import { resolveCityName } from './resolveCityName';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

/**
 * Forward geocode cities/places (Mapbox Geocoding API).
 * @param {string} query
 * @param {{ countryCode?: string, limit?: number }} options
 */
function featureMatchesRegion(feature, regionCode, regionName) {
  const rc = String(regionCode || '').trim().toUpperCase();
  const rn = String(regionName || '').trim().toLowerCase();
  if (!rc && !rn) return true;
  const ctx = Array.isArray(feature?.context) ? feature.context : [];
  for (const c of ctx) {
    if (!String(c.id || '').startsWith('region.')) continue;
    const short = String(c.short_code || '').trim().toUpperCase();
    const text = String(c.text || '').trim().toLowerCase();
    if (rc && short === rc) return true;
    if (rn && text === rn) return true;
  }
  return false;
}

/** State / province search (Mapbox Geocoding — region type, scoped by country). */
export async function searchMapboxRegions(query, options = {}) {
  const q = String(query || '').trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  const { countryCode, limit = 8 } = options;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'region',
      limit: String(Math.min(limit * 2, 10)),
      language: 'en',
      autocomplete: 'true',
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('country', cc.toLowerCase());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data.features) ? data.features : [];
    return features.slice(0, limit);
  } catch {
    return [];
  }
}

export function mapboxFeatureToRegionRow(feature, fallbackCountryCode = '') {
  if (!feature || typeof feature !== 'object') return null;
  const region = String(feature.text || '').trim();
  if (!region) return null;
  const ctx = Array.isArray(feature.context) ? feature.context : [];
  let countryCode = normalizeIso2(fallbackCountryCode);
  for (const c of ctx) {
    if (String(c.id || '').startsWith('country.')) {
      countryCode = normalizeIso2(c.short_code) || countryCode;
    }
  }
  const regionCode = normalizeRegionShortCode(
    feature.short_code || feature.properties?.short_code || ''
  );
  const label = String(feature.place_name || region).trim();
  return {
    countryCode: countryCode || normalizeIso2(fallbackCountryCode),
    region: region.slice(0, 120),
    regionCode: regionCode.slice(0, 20),
    mapboxId: String(feature.id || '').slice(0, 120),
    label: label.slice(0, 200),
  };
}

export function regionRowToOption(row) {
  const region = String(row?.region || row?.state || '').trim();
  if (!region) return null;
  return {
    ...row,
    region,
    name: region,
    code: row?.regionCode || row?.stateCode || '',
    label: row?.label || region,
  };
}

export async function searchMapboxPlaces(query, options = {}) {
  const q = String(query || '').trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  const { countryCode, regionCode, regionName, limit = 8 } = options;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'place,locality,district',
      limit: String(Math.min(limit * 2, 10)),
      language: 'en',
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('country', cc.toLowerCase());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    let features = Array.isArray(data.features) ? data.features : [];
    if (regionCode || regionName) {
      features = features.filter((f) => featureMatchesRegion(f, regionCode, regionName));
    }
    return features.slice(0, limit);
  } catch {
    return [];
  }
}

function normalizeRegionShortCode(short) {
  let s = String(short || '').trim().toUpperCase();
  if (s.includes('-')) s = s.split('-').pop();
  return s.slice(0, 20);
}

/** Street / address search (Geocoding v5 — no POI/universities). */
export async function searchMapboxAddresses(query, options = {}) {
  const q = String(query || '').trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  const { countryCode, limit = 8, proximity } = options;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'address,street,neighborhood,place,locality',
      limit: String(limit),
      language: 'en',
      autocomplete: 'true',
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('country', cc.toLowerCase());
    if (proximity) params.set('proximity', proximity);
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
 * Search Box API — includes POIs (universities, landmarks) and street addresses.
 * Returns geocoding-shaped features for existing filters/mappers.
 */
export async function searchMapboxSearchBoxForward(query, options = {}) {
  const q = String(query || '').trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  const { countryCode, limit = 10, proximity } = options;
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      q,
      limit: String(Math.min(limit, 10)),
      language: 'en',
      auto_complete: 'true',
      types: 'poi,address,street,place,locality,neighborhood',
    });
    const cc = normalizeIso2(countryCode);
    if (cc) params.set('country', cc.toLowerCase());
    if (proximity) params.set('proximity', proximity);
    const url = `https://api.mapbox.com/search/searchbox/v1/forward?${params}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const raw = Array.isArray(data.features) ? data.features : [];
    return raw.map(searchBoxFeatureToGeocodingFeature).filter(Boolean);
  } catch {
    return [];
  }
}

/** Map Search Box GeoJSON feature → Geocoding v5-like feature for shared pipeline. */
export function searchBoxFeatureToGeocodingFeature(feature) {
  if (!feature?.properties) return null;
  const p = feature.properties;
  const ctx = p.context || {};
  const context = [];
  const addCtx = (prefix, layer) => {
    if (!layer?.name) return;
    const entry = {
      id: `${prefix}.searchbox`,
      text: String(layer.name).trim(),
    };
    if (prefix === 'country' && layer.country_code) {
      entry.short_code = String(layer.country_code).toLowerCase();
    }
    if (prefix === 'region') {
      const rc = layer.region_code || layer.region_code_full || '';
      entry.short_code = String(rc).replace(/^.*-/, '').toUpperCase();
    }
    if (prefix === 'postcode') entry.short_code = String(layer.name).trim();
    context.push(entry);
  };
  addCtx('country', ctx.country);
  addCtx('region', ctx.region);
  addCtx('postcode', ctx.postcode);
  addCtx('district', ctx.district);
  addCtx('place', ctx.place);
  addCtx('locality', ctx.locality);
  addCtx('neighborhood', ctx.neighborhood);
  if (ctx.address?.street_name || ctx.address?.name) {
    context.push({
      id: 'address.searchbox',
      text: [ctx.address.address_number, ctx.address.street_name || ctx.address.name]
        .filter(Boolean)
        .join(' ')
        .trim(),
    });
  } else if (ctx.street?.name) {
    context.push({ id: 'address.searchbox', text: String(ctx.street.name).trim() });
  }

  const isPoi = p.feature_type === 'poi';
  const streetLine = String(p.address || '').trim();
  const text = isPoi
    ? String(p.name_preferred || p.name || '').trim()
    : streetLine || String(p.name || '').trim();
  const placeName = String(
    p.full_address
    || [p.address || p.name, p.place_formatted].filter(Boolean).join(', ')
    || text
  ).trim();

  const resolvedCity = resolveCityName({
    place: ctx.place?.name,
    locality: ctx.locality?.name,
    district: ctx.district?.name,
    placeName: p.place_formatted || placeName,
    suburb: ctx.neighborhood?.name,
  });

  return {
    id: String(p.mapbox_id || feature.id || ''),
    type: 'Feature',
    text,
    place_name: placeName,
    address: ctx.address?.address_number ? String(ctx.address.address_number) : undefined,
    center: feature.geometry?.coordinates,
    context,
    properties: {
      feature_type: p.feature_type,
      poi_category: p.poi_category,
      searchbox: true,
      resolved_city: resolvedCity,
    },
  };
}

function mergeAddressFeatures(primary, secondary, limit = 10) {
  const out = [];
  const seen = new Set();
  for (const f of [...primary, ...secondary]) {
    if (!f) continue;
    const key = String(f.id || f.place_name || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

/** True when Mapbox only returned cities/areas, not the place the user typed. */
function needsBroaderPlaceSearch(features, query) {
  if (!features.length) return true;
  const qWords = String(query || '')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (qWords.length < 2) return false;

  const specific = features.filter((f) => {
    const ft = f?.properties?.feature_type || '';
    const src = f?.properties?.source || '';
    return ft === 'poi' || ft === 'address' || ft === 'street' || src === 'nominatim';
  });
  if (specific.length >= 2) return false;

  const hasStrongMatch = features.some((f) => {
    const name = `${f.text || ''} ${f.place_name || ''}`.toLowerCase();
    const matched = qWords.filter((w) => name.includes(w.toLowerCase())).length;
    return matched >= Math.min(2, qWords.length);
  });
  if (!hasStrongMatch) return true;

  const onlyBroad = features.every((f) => {
    const ft = f?.properties?.feature_type || '';
    return ft === 'place' || ft === 'locality' || ft === 'district' || ft === 'country';
  });
  return onlyBroad;
}

function rankAddressFeatures(features, query) {
  const words = String(query || '').trim().split(/\s+/).filter((w) => w.length > 1);
  const score = (f) => {
    const ft = f?.properties?.feature_type || '';
    const name = `${f.text || ''} ${f.place_name || ''}`.toLowerCase();
    let s = 0;
    if (f?.properties?.source === 'nominatim' && ft === 'poi') s += 50;
    if (ft === 'poi') s += 40;
    if (ft === 'address' || ft === 'street') s += 30;
    if (ft === 'place' || ft === 'locality') s -= 20;
    for (const w of words) {
      if (name.includes(w.toLowerCase())) s += 8;
    }
    return s;
  };
  return [...features].sort((a, b) => score(b) - score(a));
}

/**
 * POI-aware address search (Search Box) with Geocoding v5 fallback for streets.
 */
export async function searchMapboxAddressesWithFallback(query, options = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const cc = normalizeIso2(options.countryCode);
  const limit = options.limit || 10;

  let features = await searchMapboxSearchBoxForward(q, options);
  if (features.length < 4) {
    const geo = await searchMapboxAddresses(q, options);
    features = mergeAddressFeatures(features, geo, limit);
  }
  if (needsBroaderPlaceSearch(features, q)) {
    const osm = await searchNominatimPlaces(q, options);
    features = mergeAddressFeatures(osm, features, limit);
  }
  if (features.length === 0 && cc) {
    features = await searchMapboxSearchBoxForward(q, { ...options, countryCode: '' });
    if (features.length < 4) {
      const geo = await searchMapboxAddresses(q, { ...options, countryCode: '' });
      features = mergeAddressFeatures(features, geo, limit);
    }
    if (needsBroaderPlaceSearch(features, q)) {
      const osm = await searchNominatimPlaces(q, { ...options, countryCode: '' });
      features = mergeAddressFeatures(osm, features, limit);
    }
  }
  return rankAddressFeatures(features, q).slice(0, limit);
}

function featureTypeLabel(feature) {
  const ft = feature?.properties?.feature_type;
  if (ft === 'poi') {
    const cats = feature?.properties?.poi_category;
    const osmType = feature?.properties?.osm_type;
    if (osmType && /universit|college|school/i.test(osmType)) return 'University / school';
    if (Array.isArray(cats) && cats.length) {
      const c = String(cats[0]).replace(/_/g, ' ');
      if (/universit|college|school|education/i.test(c)) return 'University / school';
      return c.charAt(0).toUpperCase() + c.slice(1);
    }
    return 'Place';
  }
  if (ft === 'address' || ft === 'street') return 'Address';
  if (ft === 'place' || ft === 'locality') return 'City / area';
  return '';
}

export function mapboxFeatureToAddressSuggestion(feature) {
  if (!feature || typeof feature !== 'object') return null;
  const ctx = Array.isArray(feature.context) ? feature.context : [];
  const pick = (prefix) => ctx.find((c) => String(c.id || '').startsWith(prefix));
  const house = String(feature.address || '').trim();
  const street = String(feature.text || '').trim();
  const isPoi = feature?.properties?.feature_type === 'poi';
  const line1 = isPoi
    ? street
    : [house, street].filter(Boolean).join(' ').trim()
      || String(feature.place_name || '').split(',')[0].trim();
  const placeLayer = pick('place');
  const localityLayer = pick('locality');
  const districtLayer = pick('district');
  const neighborhoodLayer = pick('neighborhood');
  const region = pick('region');
  const country = pick('country');
  const postcode = pick('postcode');
  const city =
    String(feature.properties?.resolved_city || '').trim()
    || resolveCityName({
      place: placeLayer?.text,
      locality: localityLayer?.text,
      district: districtLayer?.text,
      division: feature.properties?.historical_division,
      placeName: feature.place_name,
      suburb: neighborhoodLayer?.text,
    });
  const primaryName = isPoi ? street : line1;
  return {
    name: primaryName,
    line1: line1 || primaryName,
    formatted_address: String(feature.place_name || line1).trim(),
    city,
    state: region ? String(region.text || '').trim() : '',
    stateCode: region ? normalizeRegionShortCode(region.short_code) : '',
    zip: postcode ? String(postcode.text || '').trim() : '',
    country: country ? String(country.text || '').trim() : '',
    countryCode: country ? normalizeIso2(country.short_code) : '',
    context: ctx,
    address: feature.address ? { number: house, street } : {},
    mapboxId: String(feature.id || ''),
    featureTypeLabel: featureTypeLabel(feature),
  };
}

/** Location string for delivery-destination matching (not full place_name). */
export function deliveryLocationStringFromFeature(feature) {
  const s = mapboxFeatureToAddressSuggestion(feature);
  if (!s) return '';
  const parts = [s.line1, s.city, s.state, s.zip, s.country].filter(Boolean);
  return parts.join(', ');
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
