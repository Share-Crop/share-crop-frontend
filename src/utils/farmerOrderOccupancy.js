/** Order statuses that still hold rented area on the field (shown as occupied). */
export const FIELD_OCCUPYING_ORDER_STATUSES = ['pending', 'active', 'shipped'];

/** Orders that receive a share when farmer declares field harvest. */
export const FIELD_HARVEST_ORDER_STATUSES = ['active', 'shipped'];

export function normalizeOrderFieldId(order) {
  const fid = order?.field_id ?? order?.fieldId ?? order?.field?.id;
  return fid != null ? String(fid) : null;
}

export function orderQuantityM2(order) {
  const qtyRaw = order?.quantity ?? order?.area_rented ?? order?.area ?? 0;
  const qty = typeof qtyRaw === 'string' ? parseFloat(qtyRaw) : qtyRaw;
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function filterOrdersForField(orders, fieldId, statuses) {
  const fid = String(fieldId);
  const allowed = new Set(statuses.map((s) => s.toLowerCase()));
  return (orders || []).filter((o) => {
    if (normalizeOrderFieldId(o) !== fid) return false;
    return allowed.has(String(o?.status || '').toLowerCase());
  });
}

export function sumOrderAreaM2(orders) {
  return (orders || []).reduce((sum, o) => sum + orderQuantityM2(o), 0);
}

export function getFieldOccupancyFromOrders(orders, fieldId) {
  const occupying = filterOrdersForField(orders, fieldId, FIELD_OCCUPYING_ORDER_STATUSES);
  return {
    occupyingOrders: occupying,
    occupiedM2: sumOrderAreaM2(occupying),
  };
}

export function getFieldHarvestOrders(orders, fieldId) {
  return filterOrdersForField(orders, fieldId, FIELD_HARVEST_ORDER_STATUSES);
}

/**
 * Harvest is always allowed for the farmer.
 * Active/shipped rentals get a share; with no buyers the total is recorded only (not distributed).
 */
export function harvestEligibilityMessage(orders, fieldId) {
  const harvest = getFieldHarvestOrders(orders, fieldId);

  if (harvest.length > 0) {
    const m2 = sumOrderAreaM2(harvest);
    return {
      canHarvest: true,
      hasBuyers: true,
      text: `${harvest.length} active rental${harvest.length !== 1 ? 's' : ''} (${m2} m²) — harvest will be shared by rented area.`,
    };
  }

  return {
    canHarvest: true,
    hasBuyers: false,
    text: 'No active buyers — enter total harvest to close this season. Nothing is distributed until someone rents.',
  };
}
