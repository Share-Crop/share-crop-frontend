function parseAdminUnitName(text, suffix) {
  const re = new RegExp(`^(.+?)\\s+${suffix}$`, 'i');
  const m = String(text || '').trim().match(re);
  return m ? m[1].trim() : '';
}

function parseCityFromPlaceName(placeName) {
  const blob = String(placeName || '');
  if (!blob) return '';
  const district = blob.match(/([A-Za-z][A-Za-z\s.'-]+?)\s+District\b/i);
  if (district) return district[1].trim();
  const division = blob.match(/([A-Za-z][A-Za-z\s.'-]+?)\s+Division\b/i);
  if (division) return division[1].trim();
  return '';
}

/**
 * Resolve the postal city (e.g. Lahore), not suburb/neighbourhood (e.g. Defense).
 * OSM/Nominatim often puts sub-areas in `city` for South Asia.
 */
export function resolveCityName(parts = {}) {
  const place = String(parts.place || '').trim();
  const locality = String(parts.locality || '').trim();
  const district = String(parts.district || '').trim();
  const division = String(parts.division || '').trim();
  const placeName = String(parts.placeName || '').trim();
  const suburb = String(parts.suburb || '').trim();

  const fromDistrict = parseAdminUnitName(district, 'District');
  if (fromDistrict) return fromDistrict;

  const fromDivision = parseAdminUnitName(division, 'Division');
  if (fromDivision) return fromDivision;

  const fromPlaceName = parseCityFromPlaceName(placeName);
  if (fromPlaceName) return fromPlaceName;

  if (place && place !== locality && place !== suburb) return place;

  if (place && locality && place === locality) {
    return '';
  }

  return place || '';
}
