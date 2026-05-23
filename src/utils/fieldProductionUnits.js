import { toM2 } from './rentedFieldModels';

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

/** Estimated harvest (kg) for rented m² when production rate uses field area unit. */
export function productionKgForRentedM2(productionRate, productionRateUnit, fieldSizeUnit, rentedAreaM2) {
  const rate = typeof productionRate === 'string' ? parseFloat(productionRate) : (productionRate ?? 0);
  const area = typeof rentedAreaM2 === 'string' ? parseFloat(rentedAreaM2) : (rentedAreaM2 ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(area) || area <= 0) return 0;
  const unit = String(productionRateUnit || '').toLowerCase();
  if (/m\s*²|\/m²|\/m2|\/sqm\b|kg\/m/.test(unit)) return area * rate;
  const m2PerFieldUnit = toM2(1, fieldSizeUnit);
  if (m2PerFieldUnit > 0) return area * (rate / m2PerFieldUnit);
  return 0;
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

/** Prefer explicit total unit; else parse legacy production_rate_unit like "kg/m²". */
export function displayProductionRateUnit(field) {
  if (field?.total_production_unit != null && String(field.total_production_unit).trim() !== '') {
    return perAreaUnitSuffix(field.total_production_unit);
  }
  const pru = field?.production_rate_unit || field?.productionRateUnit;
  if (pru && String(pru).trim()) return String(pru).trim();
  return 'kg/m²';
}
