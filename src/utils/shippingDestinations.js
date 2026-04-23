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
    if (type === 'country' && countryCode) {
      out.push({ type: 'country', countryCode, ...(label ? { label } : {}) });
    } else if (type === 'city' && countryCode && city) {
      out.push({ type: 'city', countryCode, city, ...(label ? { label } : {}) });
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
  return { city, country };
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
  const uCity = u.city;

  for (const dest of d) {
    if (dest.type === 'country' && dest.countryCode) {
      if (uCountry && dest.countryCode === uCountry) return true;
      const nm = ISO2_NAME_BY_CODE.get(dest.countryCode);
      if (nm && userLocationStr && userLocationStr.toLowerCase().includes(nm.toLowerCase())) return true;
    }
    if (dest.type === 'city' && dest.countryCode && dest.city) {
      const cityOk =
        uCity &&
        dest.city &&
        uCity === String(dest.city).trim().toLowerCase();
      const countryOk = uCountry && dest.countryCode === uCountry;
      if (cityOk && countryOk) return true;
    }
  }
  return false;
}

export function shippingDestinationsSummary(destinations) {
  const d = normalizeShippingDestinations(destinations);
  if (!d.length) return '';
  const parts = d.map((x) => {
    if (x.type === 'country') return ISO2_NAME_BY_CODE.get(x.countryCode) || x.countryCode;
    if (x.type === 'city') return `${x.city} (${x.countryCode})`;
    return '';
  });
  return parts.filter(Boolean).join(', ');
}
