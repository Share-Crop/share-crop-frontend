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
  if (toNum(order.field_harvest_total) != null && toNum(order.field_harvest_total) > 0) return true;
  if (toNum(order.harvest_allocated_qty) != null && toNum(order.harvest_allocated_qty) > 0) return true;
  const op = String(order.operational_status || '').toLowerCase();
  return op === 'harvested' || op === 'shipped';
}

export function harvestUnitLabel(order) {
  return productionUnitLabel(
    order?.harvest_unit || order?.total_production_unit || order?.total_productionUnit || 'kg'
  );
}

/**
 * Estimated whole-field yield from field setup (e.g. 70 kg).
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
 * This order's share of estimated field yield by purchased area / field area.
 */
export function getEstimatedOrderYield(order) {
  const fromApi = toNum(order?.harvest_estimated_qty);
  const unit = harvestUnitLabel(order);
  if (fromApi != null && fromApi >= 0) {
    return {
      amount: fromApi,
      unit,
      text: formatAmt(fromApi, order),
    };
  }
  const fieldEst = getEstimatedFieldYield(order);
  const area = toNum(order?.quantity);
  const totalArea = fieldTotalAreaM2(order);
  if (!fieldEst || area == null || area <= 0 || !totalArea || totalArea <= 0) return null;
  const share = (area / totalArea) * fieldEst.amount;
  return {
    amount: share,
    unit: fieldEst.unit,
    text: formatAmt(share, order),
  };
}

/**
 * Order-centric harvest numbers for UI.
 * Primary number = how much THIS buyer should receive.
 */
export function getDeliverableHarvest(order, siblingOrders = []) {
  const unit = harvestUnitLabel(order);
  const fieldTotal = toNum(order?.field_harvest_total);
  let allocated = toNum(order?.harvest_allocated_qty);
  let computedFromSiblings = false;

  const sameField = (siblingOrders.length ? siblingOrders : [order]).filter(
    (o) =>
      String(o.field_id) === String(order.field_id) &&
      !['cancelled', 'pending'].includes(String(o.status || '').toLowerCase())
  );

  if ((allocated == null || allocated < 0) && fieldTotal != null && fieldTotal > 0) {
    const area = toNum(order?.quantity) || 0;
    let rented = 0;
    for (const o of sameField) {
      const q = toNum(o.quantity);
      if (q) rented += q;
    }
    if (rented > 0 && area > 0) {
      allocated = (area / rented) * fieldTotal;
      computedFromSiblings = true;
    }
  }

  const planned = getEstimatedOrderYield(order);
  const fieldPlan = getEstimatedFieldYield(order);
  const declared = Boolean(
    hasDeclaredFieldHarvest(order) && (fieldTotal != null || allocated != null)
  );

  const shareRatio =
    fieldTotal != null && fieldTotal > 0 && allocated != null
      ? allocated / fieldTotal
      : null;
  const isFullHarvest =
    fieldTotal != null &&
    allocated != null &&
    fieldTotal > 0 &&
    Math.abs(allocated - fieldTotal) / fieldTotal < 0.02;

  let deltaAmount = null;
  if (declared && allocated != null && planned?.amount != null) {
    deltaAmount = allocated - planned.amount;
  }

  let deltaPlain = null;
  if (deltaAmount != null && planned?.amount != null) {
    const absText = formatAmt(Math.abs(deltaAmount), order);
    if (Math.abs(deltaAmount) < 0.05) {
      deltaPlain = 'About the same as planned for this buyer';
    } else if (deltaAmount > 0) {
      deltaPlain = `${absText} more than planned for this buyer`;
    } else {
      deltaPlain = `${absText} less than planned for this buyer`;
    }
  }

  // Plain-language lines for farmers
  let primaryLine = null;
  let secondaryLine = null;
  let tableSecondaryLine = null;
  let contextLine = null;

  if (declared && allocated != null) {
    primaryLine = formatAmt(allocated, order);
    if (isFullHarvest) {
      secondaryLine =
        sameField.length <= 1
          ? 'Full harvest for this buyer (only rental on this field)'
          : 'This buyer gets the full harvest you entered';
      tableSecondaryLine =
        sameField.length <= 1 ? 'Only rental — full harvest' : 'Gets full harvest entered';
    } else if (fieldTotal != null) {
      const pct =
        shareRatio != null ? Math.round(shareRatio * 100) : null;
      secondaryLine =
        pct != null
          ? `${pct}% of your field harvest (${formatAmt(fieldTotal, order)} total)`
          : `From your field harvest of ${formatAmt(fieldTotal, order)}`;
      tableSecondaryLine =
        pct != null
          ? `${pct}% of field (${formatAmt(fieldTotal, order)})`
          : `From field ${formatAmt(fieldTotal, order)}`;
    }
    if (planned?.text) {
      contextLine = `Planned for this buyer: ${planned.text}`;
    }
  }

  return {
    declared,
    fieldTotal,
    allocated,
    unit,
    planned,
    fieldPlan,
    sameFieldCount: sameField.length,
    isFullHarvest,
    shareRatio,
    computedFromSiblings,
    deltaAmount,
    deltaPlain,
    // display helpers
    primaryLine,
    secondaryLine,
    tableSecondaryLine: tableSecondaryLine || secondaryLine,
    contextLine,
    fieldTotalText: fieldTotal != null ? formatAmt(fieldTotal, order) : null,
    allocatedText: allocated != null ? formatAmt(allocated, order) : null,
    // legacy aliases still used in a few places
  };
}

/**
 * Urgency relative to this order's harvest date until status becomes shipped.
 */
export function getHarvestUrgency(order) {
  const status = String(order?.status || '').toLowerCase();
  if (status === 'cancelled') {
    return { kind: 'none', label: '—', tone: 'neutral' };
  }
  if (status === 'shipped') {
    return { kind: 'shipped', label: 'Shipped', tone: 'success' };
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
