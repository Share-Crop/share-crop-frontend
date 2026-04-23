/** Shared mapping helpers for Rented Fields / owned field list UIs */

import { inferQuantitySellPercentFromField } from './fieldSellPercent';

export const normalizeAreaUnit = (raw) => {
  const u = String(raw || '').trim().toLowerCase();
  if (!u) return 'm2';
  if (u === 'm²' || u === 'm2' || u === 'sqm' || u === 'square meter' || u === 'square meters') return 'm2';
  if (u === 'acre' || u === 'acres') return 'acre';
  if (u === 'hectare' || u === 'hectares' || u === 'ha') return 'ha';
  if (u === 'sqft' || u === 'ft2' || u === 'ft²' || u === 'square feet') return 'ft2';
  return u;
};

export const unitLabel = (unit) => {
  const u = normalizeAreaUnit(unit);
  if (u === 'm2') return 'm²';
  if (u === 'acre') return 'acres';
  if (u === 'ha') return 'ha';
  if (u === 'ft2') return 'ft²';
  return unit || 'm²';
};

export const toM2 = (value, unit) => {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(v)) return 0;
  const u = normalizeAreaUnit(unit);
  if (u === 'acre') return v * 4046.8564224;
  if (u === 'ha') return v * 10000;
  if (u === 'ft2') return v * 0.092903;
  return v;
};

export const formatAreaFromM2 = (m2, unit) => {
  const v = Number(m2) || 0;
  const u = normalizeAreaUnit(unit);
  if (u === 'acre') return `${(v / 4046.8564224).toFixed(2)} acres`;
  if (u === 'ha') return `${(v / 10000).toFixed(2)} ha`;
  if (u === 'ft2') return `${Math.round(v / 0.092903).toLocaleString()} ft²`;
  return `${Math.round(v).toLocaleString()} m²`;
};

export function mapFieldFromApi(raw, currentUserId) {
  const displayUnitRaw = raw.display_unit || raw.field_size_unit || raw.unit || raw.area_unit || raw.areaUnit || 'm²';
  const displayUnit = normalizeAreaUnit(displayUnitRaw);

  const totalAreaM2 = raw.total_area_m2 != null
    ? Number(raw.total_area_m2) || 0
    : toM2(
      (typeof raw.total_area === 'string' ? parseFloat(raw.total_area) : (raw.total_area ?? raw.area_m2 ?? 0)),
      displayUnit,
    );

  const availableAreaM2 = raw.available_area_m2 != null
    ? Number(raw.available_area_m2) || 0
    : toM2(
      (typeof raw.available_area === 'string' ? parseFloat(raw.available_area) : (raw.available_area ?? 0)),
      displayUnit,
    );
  const pricePerM2 = typeof raw.price_per_m2 === 'string' ? parseFloat(raw.price_per_m2) : (raw.price_per_m2 ?? 0);
  const price = typeof raw.price === 'string' ? parseFloat(raw.price) : (raw.price ?? 0);
  const totalProduction = typeof raw.total_production === 'string' ? parseFloat(raw.total_production) : (raw.total_production ?? 0);
  const distributionPrice = typeof raw.distribution_price === 'string' ? parseFloat(raw.distribution_price) : (raw.distribution_price ?? 0);
  const retailPrice = typeof raw.retail_price === 'string' ? parseFloat(raw.retail_price) : (raw.retail_price ?? 0);
  const appFees = typeof raw.app_fees === 'string' ? parseFloat(raw.app_fees) : (raw.app_fees ?? 0);
  const potentialIncome = typeof raw.potential_income === 'string' ? parseFloat(raw.potential_income) : (raw.potential_income ?? 0);
  const quantity = typeof raw.quantity === 'string' ? parseFloat(raw.quantity) : (raw.quantity ?? 0);
  const occupiedM2 = Math.max(0, totalAreaM2 - availableAreaM2);
  const progress = totalAreaM2 > 0 ? Math.round((occupiedM2 / totalAreaM2) * 100) : 0;
  const harvestDates = Array.isArray(raw.harvest_dates)
    ? raw.harvest_dates.map((h) => (typeof h === 'object' && h?.date != null ? { date: h.date, label: h.label || '' } : { date: h, label: '' }))
    : [];
  const shippingOption = raw.shipping_option || '';
  const shippingModes = shippingOption ? shippingOption.split(/[,/]/).map((s) => s.trim()).filter(Boolean) : [];
  const availableForBuy = raw.available_for_buy !== false && raw.available_for_buy !== 'false';
  const availableForRent = raw.available_for_rent === true || raw.available_for_rent === 'true';
  const rentPricePerMonth = raw.rent_price_per_month != null && raw.rent_price_per_month !== '' ? parseFloat(raw.rent_price_per_month) : null;

  const isOwnField = currentUserId != null
    ? raw.owner_id === currentUserId
    : Boolean(raw.is_own_field);

  return {
    id: raw.id,
    name: raw.name,
    farmName: raw.farmer_name,
    location: raw.location,
    cropType: raw.category || raw.subcategory,
    category: raw.category,
    subcategory: raw.subcategory,
    is_own_field: Boolean(isOwnField),
    display_unit: displayUnit,
    area_unit: displayUnit,
    total_area: totalAreaM2,
    area_m2: totalAreaM2,
    available_area: availableAreaM2,
    occupied_area: occupiedM2,
    total_area_display: formatAreaFromM2(totalAreaM2, displayUnit),
    available_area_display: formatAreaFromM2(availableAreaM2, displayUnit),
    occupied_area_display: formatAreaFromM2(occupiedM2, displayUnit),
    area: formatAreaFromM2(occupiedM2, displayUnit),
    price_per_m2: pricePerM2,
    price,
    total_production: totalProduction,
    total_production_unit: raw.total_production_unit,
    distribution_price: distributionPrice,
    retail_price: retailPrice,
    app_fees: appFees,
    potential_income: potentialIncome,
    quantity,
    quantity_sell_percent: raw.quantity_sell_percent != null ? parseFloat(raw.quantity_sell_percent) : null,
    production_rate: raw.production_rate,
    production_rate_unit: raw.production_rate_unit,
    monthlyRent: availableForRent && rentPricePerMonth != null ? rentPricePerMonth : price,
    status: raw.available !== false ? 'Active' : 'Inactive',
    progress,
    selected_harvests: harvestDates,
    selected_harvest_date: harvestDates[0]?.date,
    selected_harvest_label: harvestDates[0]?.label,
    shipping_modes: shippingModes,
    image_url: raw.image,
    farmer_name: raw.farmer_name,
    created_at: raw.created_at,
    rentPeriod: totalAreaM2 > 0 ? 'Ongoing' : null,
    available_for_buy: availableForBuy,
    available_for_rent: availableForRent,
    rent_price_per_month: rentPricePerMonth,
    rent_duration_monthly: raw.rent_duration_monthly === true || raw.rent_duration_monthly === 'true',
    rent_duration_quarterly: raw.rent_duration_quarterly === true || raw.rent_duration_quarterly === 'true',
    rent_duration_yearly: raw.rent_duration_yearly === true || raw.rent_duration_yearly === 'true',
    estimated_delivery_days: (() => {
      const v = raw.estimated_delivery_days;
      if (v == null || v === '') return null;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) && n >= 1 ? Math.min(n, 366) : null;
    })(),
    shipping_destinations: raw.shipping_destinations ?? raw.shippingDestinations ?? [],
  };
}

export function fieldToFormInitialData(raw) {
  if (!raw) return null;
  const coords = Array.isArray(raw.coordinates) ? raw.coordinates : [];
  const lng = coords[0] != null ? Number(coords[0]) : '';
  const lat = coords[1] != null ? Number(coords[1]) : '';
  const harvestDates = Array.isArray(raw.harvest_dates)
    ? raw.harvest_dates.map((h) => (typeof h === 'object' && h != null ? { date: h.date ?? '', label: h.label ?? '' } : { date: h ?? '', label: '' }))
    : [{ date: '', label: '' }];
  return {
    ...raw,
    quantity_sell_percent: raw.quantity_sell_percent ?? raw.quantitySellPercent,
    sellingAmount: inferQuantitySellPercentFromField(raw),
    name: raw.name ?? '',
    productName: raw.name ?? '',
    category: raw.category ?? '',
    subcategory: raw.subcategory ?? '',
    description: raw.description ?? '',
    price: raw.price ?? raw.price_per_m2,
    sellingPrice: raw.price ?? raw.price_per_m2 ?? '',
    latitude: lat,
    longitude: lng,
    harvestDates: harvestDates.length ? harvestDates : [{ date: '', label: '' }],
    shippingScope: raw.shipping_scope ?? 'Global',
    shipping_destinations: raw.shipping_destinations ?? raw.shippingDestinations ?? [],
    shippingOption: raw.shipping_option ?? 'Both',
    farmId: raw.farm_id ?? '',
    fieldSize: raw.field_size ?? raw.area_m2 ?? raw.total_area ?? '',
    productionRate: raw.production_rate ?? '',
    available_for_rent: Boolean(raw.available_for_rent),
    rent_price_per_month: raw.rent_price_per_month ?? '',
    rent_duration_monthly: Boolean(raw.rent_duration_monthly),
    rent_duration_quarterly: Boolean(raw.rent_duration_quarterly),
    rent_duration_yearly: Boolean(raw.rent_duration_yearly),
  };
}

export function mapRentalFromApi(r, linkedField = null) {
  const unit = normalizeAreaUnit(r.unit || r.area_unit || r.field_size_unit || 'm2');
  const totalAreaRaw = typeof r.total_area === 'string' ? parseFloat(r.total_area) : (r.total_area ?? 0);
  const availableAreaRaw = typeof r.available_area === 'string' ? parseFloat(r.available_area) : (r.available_area ?? 0);
  const totalAreaM2 = toM2(totalAreaRaw, unit);
  const availableAreaM2 = toM2(availableAreaRaw, r.available_area_unit || 'm2');

  const areaRentedRaw = r.area_rented != null && r.area_rented !== '' ? parseFloat(r.area_rented) : 0;
  const userQuantity = parseFloat(r.quantity) || areaRentedRaw || 0;

  const fieldOccupiedM2 = Math.max(0, totalAreaM2 - availableAreaM2);
  const occupiedM2 = userQuantity > 0 ? userQuantity : fieldOccupiedM2;
  const progress = totalAreaM2 > 0 ? Math.min(100, Math.round((occupiedM2 / totalAreaM2) * 100)) : 0;
  const status = (r.status || 'active').toLowerCase();

  const userSelectedDate = r.selected_harvest_date;
  const userSelectedLabel = r.selected_harvest_label || '';

  let fieldHarvestDates = [];
  if (r.harvest_dates) {
    if (Array.isArray(r.harvest_dates)) {
      fieldHarvestDates = r.harvest_dates;
    } else if (typeof r.harvest_dates === 'string') {
      try {
        fieldHarvestDates = JSON.parse(r.harvest_dates);
      } catch (e) {
        fieldHarvestDates = [{ date: r.harvest_dates, label: '' }];
      }
    }
  }

  const harvestDates = userSelectedDate
    ? [{ date: userSelectedDate, label: userSelectedLabel }]
    : fieldHarvestDates;

  const shippingOption = r.shipping_option || '';
  const shippingModes = shippingOption ? shippingOption.split(/[,/]/).map((s) => s.trim()).filter(Boolean) : [];

  return {
    id: `rental-${r.id}`,
    _rentalId: r.id,
    _fieldId: r.field_id,
    is_own_field: false,
    name: r.field_name || r.name || `Field ${r.field_id}`,
    farmName: r.owner_name || r.farmer_name,
    location: r.field_location || r.location,
    cropType: r.category || r.subcategory || r.crop_type,
    category: r.category || r.crop_type,
    subcategory: r.subcategory,
    area_unit: unit,
    total_area: totalAreaM2,
    area_m2: totalAreaM2,
    available_area: availableAreaM2,
    occupied_area: occupiedM2,
    total_area_display: formatAreaFromM2(totalAreaM2, unit),
    available_area_display: formatAreaFromM2(availableAreaM2, unit),
    occupied_area_display: formatAreaFromM2(occupiedM2, unit),
    area: formatAreaFromM2(occupiedM2, unit),
    price_per_m2: parseFloat(r.price_per_m2) || 0,
    price: parseFloat(r.price) || 0,
    total_production: parseFloat(r.total_production) || 0,
    total_production_unit: r.total_production_unit || linkedField?.total_production_unit,
    distribution_price: parseFloat(r.distribution_price) || 0,
    retail_price: parseFloat(r.retail_price) || 0,
    app_fees: parseFloat(r.app_fees) || 0,
    potential_income: parseFloat(r.potential_income) || 0,
    quantity: userQuantity,
    production_rate: r.production_rate,
    production_rate_unit: r.production_rate_unit,
    monthlyRent: parseFloat(r.price) || parseFloat(r.rent_price) || 0,
    status: status === 'active' ? 'Active' : status === 'ended' ? 'Ended' : status === 'cancelled' ? 'Cancelled' : status,
    progress,
    selected_harvests: harvestDates,
    selected_harvest_date: userSelectedDate,
    selected_harvest_label: userSelectedLabel,
    field_harvest_dates: fieldHarvestDates.length ? fieldHarvestDates : (linkedField?.harvest_dates || linkedField?.harvestDates || []),
    harvest_dates: fieldHarvestDates.length ? fieldHarvestDates : (linkedField?.harvest_dates || linkedField?.harvestDates || []),
    harvest_date:
      userSelectedDate ||
      linkedField?.harvest_date ||
      linkedField?.harvestDate ||
      null,
    field_created_at:
      r.field_created_at ||
      r.fieldCreatedAt ||
      linkedField?.created_at ||
      linkedField?.createdAt ||
      null,
    created_at:
      linkedField?.created_at ||
      linkedField?.createdAt ||
      r.created_at ||
      r.createdAt ||
      null,
    shipping_modes: shippingModes,
    farmer_name: r.owner_name || r.farmer_name,
    rentPeriod: r.start_date && r.end_date ? `${r.start_date} – ${r.end_date}` : null,
    rental_start_date: r.start_date,
    rental_end_date: r.end_date,
  };
}
