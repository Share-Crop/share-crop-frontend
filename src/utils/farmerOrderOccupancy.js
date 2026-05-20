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

/** Human-readable hint when occupied area and harvest eligibility disagree. */
export function harvestEligibilityMessage(orders, fieldId, totalAreaM2, availableAreaM2) {
  const fid = String(fieldId);
  const allNonCancelled = (orders || []).filter((o) => {
    if (normalizeOrderFieldId(o) !== fid) return false;
    return String(o?.status || '').toLowerCase() !== 'cancelled';
  });
  const harvest = getFieldHarvestOrders(orders, fieldId);
  const { occupiedM2 } = getFieldOccupancyFromOrders(orders, fieldId);

  if (harvest.length > 0) {
    const m2 = sumOrderAreaM2(harvest);
    return {
      canHarvest: true,
      text: `${harvest.length} active rental${harvest.length !== 1 ? 's' : ''} (${m2} m²) — ready to declare harvest.`,
    };
  }

  const completedOnly = allNonCancelled.filter((o) => String(o.status || '').toLowerCase() === 'completed');
  const pendingOnly = allNonCancelled.filter((o) => String(o.status || '').toLowerCase() === 'pending');

  if (completedOnly.length > 0 && occupiedM2 === 0) {
    const m2 = sumOrderAreaM2(completedOnly);
    return {
      canHarvest: false,
      text: `${m2} m² from completed order(s) — harvest was already recorded for those renters. New purchases with Active status will appear here.`,
    };
  }

  if (pendingOnly.length > 0) {
    const m2 = sumOrderAreaM2(pendingOnly);
    return {
      canHarvest: false,
      text: `${m2} m² pending confirmation (legacy). New orders auto-confirm as Active.`,
    };
  }

  const fromApi =
    Number.isFinite(totalAreaM2) &&
    Number.isFinite(availableAreaM2) &&
    totalAreaM2 > 0 &&
    availableAreaM2 < totalAreaM2;

  if (fromApi && allNonCancelled.length === 0) {
    return {
      canHarvest: false,
      text: 'Area is marked occupied on the field, but no matching orders were found. Refresh or check Orders Received.',
    };
  }

  return {
    canHarvest: false,
    text: 'No active rentals on this field yet. When a buyer rents, their order appears here as Active.',
  };
}
