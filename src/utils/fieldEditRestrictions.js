const EPS = 0.0001;

export function toFiniteNumber(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(String(v).replace(/,/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Orders that are not fully closed: pending (unconfirmed), active, shipped, etc.
 * Only cancelled and completed are treated as cleared for delete / "no ongoing purchase".
 */
export function orderStatusBlocksFieldOrFarmDelete(status) {
  const s = String(status || '').toLowerCase().trim();
  if (!s) return true;
  if (s === 'cancelled') return false;
  if (s === 'completed') return false;
  return true;
}

export function normalizeOrdersArray(ordersList) {
  if (!ordersList) return [];
  if (Array.isArray(ordersList)) return ordersList;
  if (Array.isArray(ordersList.orders)) return ordersList.orders;
  if (Array.isArray(ordersList.data)) return ordersList.data;
  if (Array.isArray(ordersList.result)) return ordersList.result;
  if (Array.isArray(ordersList.items)) return ordersList.items;
  return [];
}

/** UUID / id used on order rows (`field_id`), not synthetic ids like `rental-123`. */
export function getFieldIdForOrderMatching(field) {
  if (!field) return null;
  const explicit = field._fieldId ?? field.field_id ?? field.fieldId;
  if (explicit != null && String(explicit).trim() !== '') return explicit;
  const id = field.id ?? field._id;
  if (id == null) return null;
  const s = String(id);
  if (s.startsWith('rental-')) return field._fieldId ?? field.field_id ?? null;
  return id;
}

export function ordersListHasBlockingOrderForField(ordersList, fieldId) {
  if (fieldId == null) return false;
  const fid = String(fieldId).trim();
  if (!fid) return false;
  const orders = normalizeOrdersArray(ordersList);
  return orders.some((o) => {
    const oid = o?.field_id ?? o?.fieldId ?? o?.field?.id ?? o?.field?._id;
    if (oid == null || String(oid).trim() !== fid) return false;
    return orderStatusBlocksFieldOrFarmDelete(o?.status);
  });
}

/** Sold / reserved area from field row alone (no order list). */
export function fieldHasSoldOrReservedArea(field) {
  if (!field) return false;

  const occ =
    toFiniteNumber(field.occupied_total_m2) ??
    toFiniteNumber(field.occupiedTotalM2) ??
    toFiniteNumber(field.occupied_area) ??
    toFiniteNumber(field.occupiedArea) ??
    toFiniteNumber(field.purchased_area) ??
    toFiniteNumber(field.occupiedM2);
  if (occ != null && occ > EPS) return true;

  const total =
    toFiniteNumber(field.total_area_m2) ??
    toFiniteNumber(field.field_size) ??
    toFiniteNumber(field.totalAreaM2) ??
    toFiniteNumber(field.total_area) ??
    0;
  const avail =
    toFiniteNumber(field.available_area_m2) ??
    toFiniteNumber(field.available_area) ??
    toFiniteNumber(field.availableAreaM2) ??
    toFiniteNumber(field.availableArea);
  if (total > EPS && avail != null && avail < total - EPS) return true;

  return false;
}

/**
 * Ongoing purchase: non-terminal order on this field (e.g. pending before confirm) OR sold/committed area.
 * @param {object} field
 * @param {Array|null|undefined} ordersList — farmer orders including pending; if omitted, only area-based checks run.
 */
export function fieldHasOngoingPurchase(field, ordersList = null) {
  if (!field) return false;
  const fid = getFieldIdForOrderMatching(field);
  const orders = normalizeOrdersArray(ordersList);
  if (orders.length > 0 && fid != null && ordersListHasBlockingOrderForField(orders, fid)) return true;
  return fieldHasSoldOrReservedArea(field);
}

/** Field cannot be removed while any non-terminal order exists on it or area is committed. */
export function fieldBlocksDeletion(field, ordersList) {
  return fieldHasOngoingPurchase(field, ordersList);
}

/**
 * Map field id -> farm id for all current fields (farmer scope). Used to block farm delete when a pending
 * order still references a field on that farm.
 */
export function buildFieldIdToFarmIdMap(fieldsArray) {
  const m = new Map();
  if (!Array.isArray(fieldsArray)) return m;
  fieldsArray.forEach((f) => {
    const fid = f?.id ?? f?._id;
    const farmId = f?.farm_id ?? f?.farmId;
    if (fid != null && farmId != null) m.set(String(fid), String(farmId));
  });
  return m;
}

/**
 * Farm removable only when it has no fields and no blocking orders for this farm or any of its (listed) fields.
 */
export function farmAllowsDelete(farm, ordersList = null, fieldIdToFarmIdMap = null) {
  const fields = farm?.fields;
  if (!Array.isArray(fields) || fields.length > 0) return false;

  const orders = normalizeOrdersArray(ordersList);
  if (orders.length === 0) return true;

  const farmIdStr = String(farm.id);
  const fieldIdsOnThisFarm = new Set(fields.map((f) => String(f.id)));

  for (const o of orders) {
    if (!orderStatusBlocksFieldOrFarmDelete(o?.status)) continue;

    if (o?.farm_id != null && String(o.farm_id) === farmIdStr) return false;

    const fid = o?.field_id ?? o?.fieldId ?? o?.field?.id;
    if (fid == null) continue;

    if (fieldIdsOnThisFarm.has(String(fid))) return false;

    if (fieldIdToFarmIdMap) {
      const mappedFarm = fieldIdToFarmIdMap.get(String(fid));
      if (mappedFarm != null && String(mappedFarm) === farmIdStr) return false;
    }
  }

  return true;
}
