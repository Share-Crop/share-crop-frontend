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
