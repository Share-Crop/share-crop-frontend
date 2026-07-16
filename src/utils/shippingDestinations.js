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
    if (!c) continue;
    const city = (row?.city || '').trim();
    const region = (row?.region || '').trim();
    const regionCode = row?.regionCode != null ? String(row.regionCode).trim() : '';
    const mapboxId = (row?.mapboxId || row?.mapbox_id || '').trim();
    const label = (row?.label || '').trim();

    if (city) {
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
      if (regionCode) entry.regionCode = regionCode.slice(0, 20);
      if (mapboxId) entry.mapboxId = mapboxId.slice(0, 120);
      if (label) entry.label = label.slice(0, 200);
      if (Array.isArray(row?.center) && row.center.length >= 2) {
        entry.center = [Number(row.center[0]), Number(row.center[1])];
      }
      out.push(entry);
      continue;
    }

    if (region || regionCode) {
      const key = `r:${c}:${(regionCode || region).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const countryName = ISO2_NAME_BY_CODE.get(c) || c;
      const entry = {
        type: 'region',
        countryCode: c,
      };
      if (region) entry.region = region.slice(0, 120);
      if (regionCode) entry.regionCode = regionCode.slice(0, 20);
      entry.label = (label || `${region || regionCode}, ${countryName}`).slice(0, 200);
      out.push(entry);
    }
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
    } else if (type === 'region' && countryCode && (region || regionCode)) {
      out.push({
        type: 'region',
        countryCode,
        ...(region ? { region } : {}),
        ...(regionCode ? { regionCode } : {}),
        ...(label ? { label } : {}),
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
  const placeOnly = d.every((x) => x.type === 'city' || x.type === 'region');
  if (countryOnly && d.length === 1) return 'Country';
  if (placeOnly && d.length === 1) return 'City';
  return 'Global';
}

function splitLocationParts(s) {
  const parts = String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const city = (parts[0] || '').toLowerCase();
  const country = (parts[parts.length - 1] || '').toLowerCase();
  // Prefer middle geographic segment as region (city, state, …, country).
  let region = '';
  if (parts.length >= 3) {
    region = (parts[1] || '').toLowerCase();
  } else if (parts.length === 2) {
    // "Florida, United States" style
    region = '';
  }
  return { city, country, region, parts };
}

/** Build a comma location string that includes state so region destinations can match. */
export function buildLocationStringFromAddress(addr = {}) {
  const city = String(addr.city || '').trim();
  const state = String(addr.state || addr.region || '').trim();
  const stateCode = String(addr.stateCode || addr.regionCode || '').trim();
  const zip = String(addr.zip || addr.postal || '').trim();
  const country = String(addr.country || '').trim();
  const countryCode = normalizeIso2(addr.countryCode || addr.country_code);
  const regionBit = state || stateCode;
  const countryBit = country || countryCode;
  return [city, regionBit, zip, countryBit].filter(Boolean).join(', ');
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

function regionDestinationMatchesUser(dest, userLocationStr, uCountry, u) {
  const locLower = String(userLocationStr || '').toLowerCase();
  const destRegion = String(dest.region || '').trim().toLowerCase();
  const destCode = String(dest.regionCode || '').trim().toLowerCase();
  const countryOk = uCountry && dest.countryCode === uCountry;

  if (!countryOk) {
    const nm = ISO2_NAME_BY_CODE.get(dest.countryCode);
    if (!nm || !locLower.includes(nm.toLowerCase())) return false;
  }

  if (dest.label && locLower.includes(String(dest.label).trim().toLowerCase())) {
    return true;
  }

  if (destRegion) {
    if (locLower.includes(destRegion)) return true;
    if (u.region && u.region === destRegion) return true;
    if ((u.parts || []).some((p) => p.toLowerCase() === destRegion)) return true;
  }

  if (destCode) {
    if (locLower.includes(destCode)) return true;
    if (String(u.region || '').toLowerCase() === destCode) return true;
    if (String(u.regionCode || '').toLowerCase() === destCode) return true;
  }

  return false;
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
 * @param {object} [addressHint] optional structured address { countryCode, state, stateCode, city }
 */
export function deliveryMatchesShippingDestinations(destinations, userLocationStr, orderForSomeoneElse, addressHint) {
  if (orderForSomeoneElse) return true;
  const d = normalizeShippingDestinations(destinations);
  if (!d.length) return null;

  const locStr = String(userLocationStr || '').trim()
    || (addressHint ? buildLocationStringFromAddress(addressHint) : '');
  const u = splitLocationParts(locStr);
  if (addressHint) {
    if (!u.region) {
      const st = String(addressHint.state || addressHint.region || '').trim().toLowerCase();
      const sc = String(addressHint.stateCode || addressHint.regionCode || '').trim().toLowerCase();
      if (st) u.region = st;
      else if (sc) u.region = sc;
    }
    u.regionCode = String(addressHint.stateCode || addressHint.regionCode || '').trim().toLowerCase();
    if (!u.city && addressHint.city) u.city = String(addressHint.city).trim().toLowerCase();
  }

  let uCountry = inferUserCountryCode(locStr);
  if (!uCountry && addressHint) {
    uCountry = normalizeIso2(addressHint.countryCode || addressHint.country_code);
  }

  for (const dest of d) {
    if (dest.type === 'country' && dest.countryCode) {
      if (uCountry && dest.countryCode === uCountry) return true;
      const nm = ISO2_NAME_BY_CODE.get(dest.countryCode);
      if (nm && locStr && locStr.toLowerCase().includes(nm.toLowerCase())) return true;
    }
    if (dest.type === 'city' && dest.countryCode && dest.city) {
      if (cityDestinationMatchesUser(dest, locStr, uCountry, u)) return true;
    }
    if (dest.type === 'region' && dest.countryCode && (dest.region || dest.regionCode)) {
      if (regionDestinationMatchesUser(dest, locStr, uCountry, u)) return true;
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
    if (x.type === 'region') {
      if (x.label) return x.label;
      const countryName = ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
      return `${x.region || x.regionCode}, ${countryName}`;
    }
    return '';
  });
  return parts.filter(Boolean).join(', ');
}

/** Structured list for compact UI (chips, collapsible coverage). */
export function summarizeShippingDestinations(destinations) {
  const d = normalizeShippingDestinations(destinations);
  const countries = [];
  const cities = [];
  const regions = [];
  for (const x of d) {
    if (x.type === 'country') {
      const name = ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
      if (name) countries.push(name);
    } else if (x.type === 'city') {
      let label = x.label;
      if (!label) {
        const countryName = ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
        label = x.region ? `${x.city}, ${x.region}` : `${x.city}, ${countryName}`;
      }
      if (label) cities.push(label);
    } else if (x.type === 'region') {
      let label = x.label;
      if (!label) {
        const countryName = ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
        label = `${x.region || x.regionCode}, ${countryName}`;
      }
      if (label) regions.push(label);
    }
  }
  return {
    countries,
    cities,
    regions,
    countryCount: countries.length,
    cityCount: cities.length,
    regionCount: regions.length,
    total: countries.length + cities.length + regions.length,
  };
}

export function shippingCoverageShortLabel(destinations, shippingScope) {
  const { countryCount, cityCount, regionCount, total } = summarizeShippingDestinations(destinations);
  if (total === 0) {
    const scope = String(shippingScope || 'Global').toLowerCase();
    if (scope === 'global') return 'Worldwide';
    return String(shippingScope || '');
  }
  const bits = [];
  if (countryCount) bits.push(`${countryCount} ${countryCount === 1 ? 'country' : 'countries'}`);
  if (regionCount) bits.push(`${regionCount} ${regionCount === 1 ? 'state/province' : 'states/provinces'}`);
  if (cityCount) bits.push(`${cityCount} ${cityCount === 1 ? 'city' : 'cities'}`);
  return bits.join(' · ');
}

/** Last meaningful segment(s) of a comma-separated address for display. */
export function shortenLocationLabel(locationStr, maxParts = 2) {
  if (!locationStr || typeof locationStr !== 'string') return '';
  const parts = locationStr.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return locationStr.trim();
  if (parts.length <= maxParts) return parts.join(', ');
  return parts.slice(-maxParts).join(', ');
}
