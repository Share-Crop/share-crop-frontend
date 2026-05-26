import { ISO2_COUNTRY_OPTIONS } from '../data/isoCountryOptions';

const ISO2_NAME_BY_CODE = new Map(ISO2_COUNTRY_OPTIONS.map((o) => [o.code, o.name]));
const ISO2_BY_NAME_LOWER = new Map(
  ISO2_COUNTRY_OPTIONS.map((o) => [o.name.trim().toLowerCase(), o.code])
);

export function normalizeIso2(code) {
  if (code == null || code === '') return '';
  const s = String(code).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : '';
}

export function emptyShippingCityRow() {
  return {
    countryCode: '',
    city: '',
    region: '',
    regionCode: '',
    mapboxId: '',
    label: '',
    center: null,
  };
}

/** Build API payload from Create Field shipping UI state. */
export function buildShippingDestinationsFromUi(countryCodes, cityRows) {
  const out = [];
  const seen = new Set();
  for (const code of countryCodes || []) {
    const c = normalizeIso2(code);
    if (!c || seen.has(`c:${c}`)) continue;
    seen.add(`c:${c}`);
    out.push({ type: 'country', countryCode: c });
  }
  for (const row of cityRows || []) {
    const c = normalizeIso2(row?.countryCode);
    const city = (row?.city || '').trim();
    if (!c || !city) continue;
    const region = (row?.region || '').trim();
    const mapboxId = (row?.mapboxId || row?.mapbox_id || '').trim();
    const label = (row?.label || '').trim();
    const key = mapboxId
      ? `id:${mapboxId}`
      : `t:${c}:${city.toLowerCase()}:${region.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = {
      type: 'city',
      countryCode: c,
      city: city.slice(0, 120),
    };
    if (region) entry.region = region.slice(0, 120);
    if (row?.regionCode) entry.regionCode = String(row.regionCode).trim().slice(0, 20);
    if (mapboxId) entry.mapboxId = mapboxId.slice(0, 120);
    if (label) entry.label = label.slice(0, 200);
    if (Array.isArray(row?.center) && row.center.length >= 2) {
      entry.center = [Number(row.center[0]), Number(row.center[1])];
    }
    out.push(entry);
  }
  return out.slice(0, 50);
}

/** Normalize API / DB value to an array of destination objects. */
export function normalizeShippingDestinations(raw) {
  if (raw == null || raw === '') return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const type = String(item.type || '').toLowerCase();
    const countryCode = normalizeIso2(item.countryCode ?? item.country_code);
    const city = item.city != null ? String(item.city).trim() : '';
    const label = item.label != null ? String(item.label).trim() : '';
    const region = item.region != null ? String(item.region).trim() : '';
    const regionCode = item.regionCode != null ? String(item.regionCode).trim() : '';
    const mapboxId = item.mapboxId != null ? String(item.mapboxId).trim() : '';
    const center = Array.isArray(item.center) && item.center.length >= 2
      ? [Number(item.center[0]), Number(item.center[1])]
      : null;
    if (type === 'country' && countryCode) {
      out.push({ type: 'country', countryCode, ...(label ? { label } : {}) });
    } else if (type === 'city' && countryCode && city) {
      out.push({
        type: 'city',
        countryCode,
        city,
        ...(label ? { label } : {}),
        ...(region ? { region } : {}),
        ...(regionCode ? { regionCode } : {}),
        ...(mapboxId ? { mapboxId } : {}),
        ...(center ? { center } : {}),
      });
    }
  }
  return out;
}

export function deriveShippingScopeEnum(destinations, fallbackScope) {
  const d = Array.isArray(destinations) ? destinations : [];
  if (d.length === 0) {
    const s = String(fallbackScope || 'Global').trim();
    return ['City', 'Country', 'Global'].includes(s) ? s : 'Global';
  }
  const countryOnly = d.every((x) => x.type === 'country');
  const cityOnly = d.every((x) => x.type === 'city');
  if (countryOnly && d.length === 1) return 'Country';
  if (cityOnly && d.length === 1) return 'City';
  return 'Global';
}

function splitLocationParts(s) {
  const parts = String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const city = (parts[0] || '').toLowerCase();
  const country = (parts[parts.length - 1] || '').toLowerCase();
  const region = parts.length >= 3 ? (parts[1] || '').toLowerCase() : '';
  return { city, country, region, parts };
}

function cityDestinationMatchesUser(dest, userLocationStr, uCountry, u) {
  const locLower = String(userLocationStr || '').toLowerCase();
  const destCity = String(dest.city || '').trim().toLowerCase();
  const destRegion = String(dest.region || '').trim().toLowerCase();
  const countryOk = uCountry && dest.countryCode === uCountry;

  if (dest.label && locLower.includes(String(dest.label).trim().toLowerCase())) {
    return true;
  }

  if (!countryOk || !destCity) return false;

  if (dest.mapboxId && locLower.includes(destCity)) {
    if (!destRegion) return true;
    if (locLower.includes(destRegion)) return true;
    if (u.region && u.region === destRegion) return true;
  }

  const cityOk = u.city && u.city === destCity;
  if (!cityOk && !locLower.includes(destCity)) return false;

  if (!destRegion) {
    return cityOk || locLower.includes(destCity);
  }

  return (
    locLower.includes(destRegion) ||
    u.region === destRegion ||
    (u.parts || []).some((p) => p.toLowerCase() === destRegion)
  );
}

function inferUserCountryCode(userLocationStr) {
  const { country } = splitLocationParts(userLocationStr);
  if (!country) return '';
  if (country.length === 2 && /^[a-z]{2}$/.test(country)) return country.toUpperCase();
  const byName = ISO2_BY_NAME_LOWER.get(country);
  if (byName) return byName;
  for (const [name, code] of ISO2_BY_NAME_LOWER.entries()) {
    if (country.includes(name) || name.includes(country)) return code;
  }
  return '';
}

/**
 * When destinations list is non-empty: true if buyer location matches at least one rule.
 * When empty: returns null (caller should use legacy shipping_scope rules).
 */
export function deliveryMatchesShippingDestinations(destinations, userLocationStr, orderForSomeoneElse) {
  if (orderForSomeoneElse) return true;
  const d = normalizeShippingDestinations(destinations);
  if (!d.length) return null;
  const u = splitLocationParts(userLocationStr);
  const uCountry = inferUserCountryCode(userLocationStr);

  for (const dest of d) {
    if (dest.type === 'country' && dest.countryCode) {
      if (uCountry && dest.countryCode === uCountry) return true;
      const nm = ISO2_NAME_BY_CODE.get(dest.countryCode);
      if (nm && userLocationStr && userLocationStr.toLowerCase().includes(nm.toLowerCase())) return true;
    }
    if (dest.type === 'city' && dest.countryCode && dest.city) {
      if (cityDestinationMatchesUser(dest, userLocationStr, uCountry, u)) return true;
    }
  }
  return false;
}

export function shippingDestinationsSummary(destinations) {
  const d = normalizeShippingDestinations(destinations);
  if (!d.length) return '';
  const parts = d.map((x) => {
    if (x.type === 'country') return ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
    if (x.type === 'city') {
      if (x.label) return x.label;
      if (x.region) return `${x.city}, ${x.region} (${x.countryCode})`;
      return `${x.city} (${x.countryCode})`;
    }
    return '';
  });
  return parts.filter(Boolean).join(', ');
}
