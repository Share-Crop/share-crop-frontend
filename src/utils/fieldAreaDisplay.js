import { toM2, normalizeAreaUnit, unitLabel } from './rentedFieldModels';

/** Resolve the unit the farmer chose (display_unit wins over legacy m² defaults). */
export function inferFieldAreaUnit(prod) {
  if (!prod) return 'm2';
  const rateUnit = String(prod.production_rate_unit || prod.productionRateUnit || '');
  if (/sq\.?\s*ft|ft²|\/ft2|square\s*feet/i.test(rateUnit)) return 'ft2';
  if (/\/acre|acres/i.test(rateUnit)) return 'acre';
  if (/\/ha\b|hectare/i.test(rateUnit)) return 'ha';
  const candidates = [
    prod.display_unit,
    prod.field_size_unit,
    prod.fieldSizeUnit,
    prod.unit,
  ];
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') {
      return normalizeAreaUnit(c);
    }
  }
  return 'm2';
}

/** Canonical field total area in m² (for API / rent math). */
export function getFieldTotalAreaM2(prod) {
  if (!prod) return 0;
  const n = (v) => (typeof v === 'string' ? parseFloat(v) : v);
  const tam = n(prod.total_area_m2);
  if (Number.isFinite(tam) && tam > 0) return tam;
  const am = n(prod.area_m2);
  if (Number.isFinite(am) && am > 0) return am;
  const ta = n(prod.total_area);
  const unit = inferFieldAreaUnit(prod);
  if (Number.isFinite(ta) && ta > 0) {
    const asM2 = unit === 'm2' ? ta : toM2(ta, unit);
    if (asM2 > 0) return asM2;
  }
  const fs = n(prod.field_size ?? prod.fieldSize);
  if (Number.isFinite(fs) && fs > 0) {
    const converted = toM2(fs, unit);
    if (converted > 0) return converted;
  }
  return 0;
}

export function m2PerFieldDisplayUnit(prod) {
  const unit = inferFieldAreaUnit(prod);
  const m2 = toM2(1, unit);
  return m2 > 0 ? m2 : 1;
}

/** Convert m² → farmer's area unit. */
export function m2ToFieldUnitValue(m2, prodOrUnit) {
  const m2v = typeof m2 === 'string' ? parseFloat(m2) : m2;
  if (!Number.isFinite(m2v)) return 0;
  const unit = typeof prodOrUnit === 'object' ? inferFieldAreaUnit(prodOrUnit) : normalizeAreaUnit(prodOrUnit);
  if (unit === 'ft2') return m2v / 0.092903;
  if (unit === 'acre') return m2v / 4046.8564224;
  if (unit === 'ha') return m2v / 10000;
  return m2v;
}

function formatAreaNumber(val, unit) {
  const u = normalizeAreaUnit(unit);
  if (u === 'acre' || u === 'ha') {
    return val.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
  return Math.round(val).toLocaleString();
}

/** Total field size in the farmer's unit (e.g. 200 sq. ft). */
export function getFarmerFieldSizeValue(prod) {
  const unit = inferFieldAreaUnit(prod);
  const fs = parseFloat(prod?.field_size ?? prod?.fieldSize);
  const totalM2 = getFieldTotalAreaM2(prod);

  if (Number.isFinite(fs) && fs > 0 && totalM2 > 0) {
    const asM2 = toM2(fs, unit);
    if (Math.abs(asM2 - totalM2) / Math.max(totalM2, 1) < 0.08) {
      return fs;
    }
    if (unit !== 'm2' && Math.abs(fs - totalM2) / Math.max(totalM2, 1) < 0.08) {
      return m2ToFieldUnitValue(totalM2, unit);
    }
    if (unit !== 'm2') {
      return m2ToFieldUnitValue(totalM2, unit);
    }
    return fs;
  }
  if (totalM2 > 0) return m2ToFieldUnitValue(totalM2, unit);
  return Number.isFinite(fs) && fs > 0 ? fs : 0;
}

/**
 * Area for UI: pass m² from API, or omit for total field size.
 * @returns {{ value: number, unit: string, text: string }}
 */
export function areaDisplay(field, m2Value) {
  if (!field) return { value: 0, unit: 'm²', text: '' };
  const unitKey = inferFieldAreaUnit(field);
  const u = unitLabel(unitKey);
  const value = m2Value != null && m2Value !== ''
    ? m2ToFieldUnitValue(m2Value, unitKey)
    : getFarmerFieldSizeValue(field);
  const text = value > 0 ? `${formatAreaNumber(value, unitKey)} ${u}` : '';
  return { value, unit: u, text };
}

/** Price per field area unit for UI. */
export function priceAreaDisplay(field) {
  if (!field) return { value: 0, unit: 'm²', text: '$0.00/m²' };
  const ppm2 = parseFloat(field.price_per_m2 ?? field.price ?? 0) || 0;
  const u = unitLabel(inferFieldAreaUnit(field));
  const value = inferFieldAreaUnit(field) === 'm2'
    ? ppm2
    : (pricePerDisplayUnitFromM2(ppm2, field) ?? ppm2);
  return { value, unit: u, text: `$${value.toFixed(2)}/${u}` };
}

export function formatFieldSizeLabel(prod) {
  return areaDisplay(prod).text;
}

/** Format an m² amount in the farmer's unit (occupied, available, rented). */
export function formatAreaInFieldUnit(prod, m2Value) {
  return areaDisplay(prod, m2Value).text;
}

export function fieldAreaUnitShort(prod) {
  return areaDisplay(prod).unit;
}

/** Quantity in farmer unit → m² for API. */
export function fieldUnitQuantityToM2(prod, qtyInFieldUnit) {
  const q = typeof qtyInFieldUnit === 'string' ? parseFloat(qtyInFieldUnit) : qtyInFieldUnit;
  if (!Number.isFinite(q) || q <= 0) return 0;
  return q * m2PerFieldDisplayUnit(prod);
}

/** $/m² → $/farmer display unit. */
export function pricePerDisplayUnitFromM2(pricePerM2, prod) {
  const p = parseFloat(pricePerM2);
  if (!Number.isFinite(p)) return null;
  return p * m2PerFieldDisplayUnit(prod);
}

export function formatAreaM2Int(val) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!Number.isFinite(num)) return '0';
  return Math.round(num).toLocaleString();
}

export function parseFieldDeliveryCharges(raw) {
  if (raw == null || raw === '') return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(arr) ? arr : [];
}

export function formatDeliveryChargesSummary(raw) {
  const list = parseFieldDeliveryCharges(raw);
  if (!list.length) return '';
  return list
    .map((t) => {
      const amount = parseFloat(t.amount);
      const amtStr = Number.isFinite(amount) ? `$${amount.toFixed(2)}` : '';
      if (t.upto != null && t.upto !== '') {
        return `Up to ${t.upto}: ${amtStr}`;
      }
      return amtStr ? `Flat: ${amtStr}` : '';
    })
    .filter(Boolean)
    .join(' · ');
}

/** Sorted delivery fee tiers for compact UI. */
export function getDeliveryFeeTiers(raw) {
  const list = parseFieldDeliveryCharges(raw);
  return list
    .map((t) => ({
      upto: t.upto != null && t.upto !== '' ? parseFloat(t.upto) : null,
      amount: parseFloat(t.amount),
    }))
    .filter((t) => Number.isFinite(t.amount))
    .sort((a, b) => {
      const au = Number.isFinite(a.upto) ? a.upto : Infinity;
      const bu = Number.isFinite(b.upto) ? b.upto : Infinity;
      return au - bu;
    });
}

export function getMinDeliveryFee(raw) {
  const tiers = getDeliveryFeeTiers(raw);
  if (!tiers.length) return null;
  return Math.min(...tiers.map((t) => t.amount));
}
