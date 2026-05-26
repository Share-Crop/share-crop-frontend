import { toM2, normalizeAreaUnit } from './rentedFieldModels';

/** Canonical DB values for fields.total_production_unit */
export const TOTAL_PRODUCTION_UNITS = ['kg', 'L', 'lbs', 'units'];

export function normalizeTotalProductionUnit(raw) {
  if (raw == null || raw === '') return 'kg';
  const s = String(raw).trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms'].includes(s)) return 'kg';
  if (['l', 'lt', 'liter', 'liters', 'litre', 'litres'].includes(s)) return 'L';
  if (['lbs', 'lb', 'pound', 'pounds'].includes(s)) return 'lbs';
  if (['units', 'unit', 'pcs', 'pieces'].includes(s)) return 'units';
  return 'kg';
}

/** Short label for UI (prices, totals). */
export function productionUnitLabel(raw) {
  const u = normalizeTotalProductionUnit(raw);
  if (u === 'L') return 'L';
  if (u === 'lbs') return 'lbs';
  if (u === 'units') return 'units';
  return 'kg';
}

export function perAreaUnitSuffix(raw) {
  return `${productionUnitLabel(raw)}/m²`;
}

/** Area unit label for formulas (matches Create Field unit dropdown). */
export function fieldAreaUnitLabel(raw) {
  const u = String(raw || 'sqm').trim().toLowerCase();
  if (u === 'sqm' || u === 'm2' || u === 'm²') return 'm²';
  if (u === 'sqft' || u === 'sq ft' || u === 'sq. ft' || u === 'ft2' || u === 'ft²') return 'sq. ft';
  if (u === 'acres' || u === 'acre') return 'acre';
  if (u === 'hectares' || u === 'hectare' || u === 'ha') return 'hectare';
  return String(raw || 'm²');
}

export function perAreaUnitSuffixWithFieldArea(productionUnitRaw, fieldAreaUnitRaw) {
  return `${productionUnitLabel(productionUnitRaw)}/${fieldAreaUnitLabel(fieldAreaUnitRaw)}`;
}

export function pricePerFieldAreaUnitSuffix(fieldAreaUnitRaw) {
  return `$/${fieldAreaUnitLabel(fieldAreaUnitRaw)}`;
}

/** Convert $/field-area-unit → $/m² for backend rent math. */
export function pricePerM2FromFieldAreaPrice(pricePerFieldUnit, fieldAreaUnitRaw) {
  const price = parseFloat(pricePerFieldUnit);
  if (!Number.isFinite(price)) return 0;
  const m2PerUnit = toM2(1, fieldAreaUnitRaw);
  if (!m2PerUnit || m2PerUnit <= 0) return price;
  return price / m2PerUnit;
}

/** True when rate is per m² and the field actually uses m² (not sq.ft / acre / ha). */
export function isProductionRatePerM2(productionRateUnit, fieldAreaUnitRaw) {
  const unit = String(productionRateUnit || '').toLowerCase();
  if (!/\/\s*m\s*²|\/\s*m2\b|\/sqm\b/.test(unit)) return false;
  return normalizeAreaUnit(fieldAreaUnitRaw) === 'm2';
}

/**
 * Estimated harvest for a rented/purchased area.
 * - Rate per m² (kg/m²): harvest = areaM2 × rate
 * - Rate per field unit (kg/sq. ft, kg/acre, …): harvest = areaM2 × (rate / m² per 1 field unit)
 *
 * Example: 5 kg/sq. ft, 200 sq. ft field → 1000 kg; buyer rents 18.58 m² (=200 sq.ft) → 1000 kg.
 */
export function productionKgForRentedM2(productionRate, productionRateUnit, fieldSizeUnit, rentedAreaM2) {
  const rate = typeof productionRate === 'string' ? parseFloat(productionRate) : (productionRate ?? 0);
  const area = typeof rentedAreaM2 === 'string' ? parseFloat(rentedAreaM2) : (rentedAreaM2 ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(area) || area <= 0) return 0;
  if (isProductionRatePerM2(productionRateUnit, fieldSizeUnit)) {
    return area * rate;
  }
  const m2PerFieldUnit = toM2(1, fieldSizeUnit);
  if (m2PerFieldUnit > 0) return area * (rate / m2PerFieldUnit);
  return 0;
}

/** Harvest for a field record; area must be in m² (order/API). Uses correct unit conversion. */
export function productionAmountForField(field, rentedAreaM2) {
  if (!field) return 0;
  const rate = parseFloat(field.production_rate ?? field.productionRate);
  if (!Number.isFinite(rate)) return 0;
  const rateUnit = displayProductionRateUnit(field);
  const fieldAreaUnit = resolveFieldAreaUnitRaw(field);
  return productionKgForRentedM2(rate, rateUnit, fieldAreaUnit, rentedAreaM2);
}

export function usdPerProductionUnitSuffix(raw) {
  return `USD / ${productionUnitLabel(raw)}`;
}

export function formatTotalProductionWithUnit(value, unitRaw) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  const label = productionUnitLabel(unitRaw);
  if (value == null || value === '' || Number.isNaN(n)) return `0 ${label}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${label}`;
}

/** Field area unit for production labels (display_unit wins over legacy m² defaults). */
export function resolveFieldAreaUnitRaw(field) {
  const rateUnit = String(field?.production_rate_unit || field?.productionRateUnit || '');
  if (/sq\.?\s*ft|ft²|\/ft2|square\s*feet/i.test(rateUnit)) return 'sqft';
  if (/\/acre|acres/i.test(rateUnit)) return 'acre';
  if (/\/ha\b|hectare/i.test(rateUnit)) return 'ha';
  return field?.display_unit
    || field?.field_size_unit
    || field?.fieldSizeUnit
    || field?.unit
    || 'sqm';
}

/**
 * Per-area production suffix for UI (e.g. kg/sq. ft).
 * Uses production_rate_unit when it matches the field area; otherwise builds from
 * total_production_unit + field area unit (fixes stale kg/m² in DB for sq.ft fields).
 */
export function displayProductionRateUnit(field) {
  const areaUnit = resolveFieldAreaUnitRaw(field);
  const areaLabel = fieldAreaUnitLabel(areaUnit);
  const prodUnit = field?.total_production_unit ?? 'kg';
  const built = () => perAreaUnitSuffixWithFieldArea(prodUnit, areaUnit);

  const pru = String(field?.production_rate_unit || field?.productionRateUnit || '').trim();
  if (!pru) return built();
  if (!pru.includes('/')) return built();

  const pruLower = pru.toLowerCase();
  const rateUsesM2 = /\/\s*m\s*²|\/\s*m2\b|\/sqm\b/.test(pruLower);
  const fieldIsM2 = areaUnit === 'm2' || areaLabel === 'm²';
  if (rateUsesM2 && !fieldIsM2) return built();
  if (!rateUsesM2 && fieldIsM2 && /sq\.?\s*ft|ft²|\/ft2/.test(pruLower)) return built();

  return pru;
}

/** Production rate for UI — value + unit + combined text. */
export function productionRateDisplay(field) {
  const raw = field?.production_rate ?? field?.productionRate;
  const value = typeof raw === 'string' ? parseFloat(raw) : raw;
  const unit = displayProductionRateUnit(field);
  if (raw == null || raw === '' || !Number.isFinite(value)) {
    return { value: null, unit, text: 'N/A' };
  }
  return {
    value,
    unit,
    text: `${value} ${unit}`,
  };
}
