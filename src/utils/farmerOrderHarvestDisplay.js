import { getOrderHarvestYmd } from './orderHarvestGate';
import { formatTotalProductionWithUnit, productionUnitLabel } from './fieldProductionUnits';

function toNum(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function diffCalendarDaysYmd(fromYmd, toYmd) {
  const [fy, fm, fd] = String(fromYmd).slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = String(toYmd).slice(0, 10).split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

function fieldTotalAreaM2(order) {
  return (
    toNum(order?.total_area_m2) ||
    toNum(order?.totalAreaM2) ||
    toNum(order?.area_m2) ||
    toNum(order?.total_area) ||
    toNum(order?.totalArea) ||
    null
  );
}

function formatAmt(amount, order) {
  if (amount == null) return null;
  return formatTotalProductionWithUnit(amount, order?.harvest_unit || order?.total_production_unit);
}

/**
 * Whether the farmer has declared actual total harvest for this order's field.
 */
export function hasDeclaredFieldHarvest(order) {
  if (!order) return false;
  if (toNum(order.harvest_allocated_qty) != null && toNum(order.harvest_allocated_qty) > 0) return true;
  if (toNum(order.field_harvest_total) != null && toNum(order.field_harvest_total) > 0) return true;
  if (toNum(order.harvest_estimated_qty) != null && toNum(order.harvest_estimated_qty) > 0) {
    // Allocation row exists for this order (season-scoped).
    return toNum(order.field_harvest_total) != null;
  }
  return false;
}

export function harvestUnitLabel(order) {
  return productionUnitLabel(
    order?.harvest_unit || order?.total_production_unit || order?.total_productionUnit || 'kg'
  );
}

/**
 * Estimated whole-field yield from field setup (e.g. 120 kg).
 */
export function getEstimatedFieldYield(order) {
  const total = toNum(order?.total_production ?? order?.totalProduction);
  if (total == null || total < 0) return null;
  return {
    amount: total,
    unit: harvestUnitLabel(order),
    text: formatAmt(total, order),
  };
}

/**
 * Order area share of the field: order_m2 / field_total_m2.
 * Example: 0.65 / 10 = 0.065
 */
export function getOrderAreaShare(order) {
  const area = toNum(order?.quantity);
  const totalArea = fieldTotalAreaM2(order);
  if (area == null || area <= 0 || !totalArea || totalArea <= 0) return null;
  return area / totalArea;
}

/**
 * This order's share of estimated field yield by purchased area / field area.
 * Example: 120 kg setup × (0.65 / 10) = 7.8 kg
 */
export function getEstimatedOrderYield(order) {
  const fieldEst = getEstimatedFieldYield(order);
  const share = getOrderAreaShare(order);
  if (!fieldEst || share == null) return null;
  const amount = fieldEst.amount * share;
  return {
    amount,
    unit: fieldEst.unit,
    text: formatAmt(amount, order),
  };
}

function isClosedOrderStatus(order) {
  const s = String(order?.status || '').toLowerCase();
  return s === 'completed' || s === 'shipped' || s === 'cancelled';
}

/**
 * Simple farmer-facing numbers for one order:
 * - Prefer season-scoped allocation columns from API when present (safe after list-again)
 * - Else estimated = setup total × (order area / field area)
 * - actual = harvest entered × share (only when this order has an allocation / declared harvest)
 */
export function getDeliverableHarvest(order) {
  const unit = harvestUnitLabel(order);
  const share = getOrderAreaShare(order);
  const allocatedQty = toNum(order?.harvest_allocated_qty);
  const estimatedQty = toNum(order?.harvest_estimated_qty);
  const fieldSetupTotal = toNum(order?.total_production ?? order?.totalProduction);
  const fieldHarvestTotal = toNum(order?.field_harvest_total);
  const closed = isClosedOrderStatus(order);

  // Prefer DB allocation for this order (tied to the harvest event this order belonged to).
  let estimated = estimatedQty != null && estimatedQty >= 0 ? estimatedQty : null;
  let actual = allocatedQty != null && allocatedQty > 0 ? allocatedQty : null;

  if (estimated == null && !closed && fieldSetupTotal != null && fieldSetupTotal >= 0 && share != null) {
    estimated = fieldSetupTotal * share;
  }
  // Closed/past-season without allocation: do not recompute Est from live (relisted) total_production.
  if (estimated == null && closed && estimatedQty == null && allocatedQty == null) {
    estimated = null;
  }

  const declared =
    (actual != null && actual > 0) ||
    (hasDeclaredFieldHarvest(order) && fieldHarvestTotal != null && fieldHarvestTotal > 0);

  if (actual == null && declared && share != null && fieldHarvestTotal != null) {
    // Only apply live field harvest share for open (current-season) orders.
    if (!closed) {
      actual = fieldHarvestTotal * share;
    }
  }

  const estimatedText = estimated != null ? formatAmt(estimated, order) : null;
  const actualText = actual != null ? formatAmt(actual, order) : null;

  const primaryLine = actualText;
  const secondaryLine = estimatedText ? `Est. ${estimatedText}` : null;
  const tableSecondaryLine = estimatedText ? `Est ${estimatedText}` : null;

  return {
    declared: Boolean(actual != null && actual > 0),
    unit,
    share,
    orderArea: toNum(order?.quantity),
    fieldArea: fieldTotalAreaM2(order),
    fieldSetupTotal,
    fieldHarvestTotal,
    estimated,
    actual,
    estimatedText,
    actualText,
    planned: estimatedText
      ? { amount: estimated, unit, text: estimatedText }
      : null,
    fieldPlan: fieldSetupTotal != null && !closed
      ? { amount: fieldSetupTotal, unit, text: formatAmt(fieldSetupTotal, order) }
      : null,
    fieldTotal: fieldHarvestTotal,
    allocated: actual,
    primaryLine,
    secondaryLine,
    tableSecondaryLine,
    contextLine: null,
    fieldTotalText: fieldHarvestTotal != null ? formatAmt(fieldHarvestTotal, order) : null,
    allocatedText: actualText,
  };
}

/**
 * Urgency relative to this order's harvest date until status becomes shipped/completed.
 */
export function getHarvestUrgency(order) {
  const status = String(order?.status || '').toLowerCase();
  if (status === 'cancelled') {
    return { kind: 'none', label: '—', tone: 'neutral' };
  }
  if (status === 'shipped') {
    return { kind: 'shipped', label: 'Shipped', tone: 'success' };
  }
  if (status === 'completed') {
    return { kind: 'completed', label: 'Completed', tone: 'success' };
  }

  const ymd = getOrderHarvestYmd(order);
  if (!ymd) {
    return { kind: 'none', label: 'No harvest date', tone: 'neutral' };
  }

  const daysFromHarvest = diffCalendarDaysYmd(ymd, todayYmdLocal());

  if (daysFromHarvest < 0) {
    const daysLeft = Math.abs(daysFromHarvest);
    return {
      kind: 'countdown',
      label: daysLeft === 1 ? '1 day left' : `${daysLeft} days left`,
      daysLeft,
      tone: daysLeft <= 3 ? 'warning' : 'info',
    };
  }
  if (daysFromHarvest === 0) {
    return { kind: 'today', label: 'Harvest today', tone: 'warning' };
  }
  const daysPast = daysFromHarvest;
  return {
    kind: 'delivery',
    label: daysPast === 1 ? 'Delivery needed · 1 day past harvest' : `Delivery needed · ${daysPast} days past harvest`,
    shortLabel: daysPast === 1 ? '1d late' : `${daysPast}d late`,
    daysPast,
    tone: 'urgent',
  };
}

export function urgencyChipSx(tone) {
  if (tone === 'urgent') {
    return { bgcolor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700 };
  }
  if (tone === 'warning') {
    return { bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 };
  }
  if (tone === 'success') {
    return { bgcolor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 600 };
  }
  if (tone === 'info') {
    return { bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600 };
  }
  return { bgcolor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 500 };
}
