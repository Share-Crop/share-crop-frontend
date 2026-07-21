/**
 * Keep order/rental UI bound to the order's own harvest selection.
 * Never inherit a field's live harvest_dates after list-again (new season).
 */

export function orderHarvestYmd(orderOrRow) {
  if (!orderOrRow) return null;
  const raw =
    orderOrRow.order_selected_harvest_date ??
    orderOrRow.selected_harvest_date ??
    orderOrRow.delivery_date ??
    null;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/**
 * Overlay fields so HarvestProgressBar / resolveHarvestDate cannot pick a relisted schedule.
 */
export function lockOrderHarvestDisplay(orderOrRow = {}) {
  const ymd = orderHarvestYmd(orderOrRow);
  const label = String(
    orderOrRow.selected_harvest_label || orderOrRow.selectedHarvestLabel || ''
  ).trim();
  const lockedList = ymd ? [{ date: ymd, label }] : [];
  return {
    order_selected_harvest_date: ymd,
    selected_harvest_date: ymd,
    selected_harvest_label: label || null,
    delivery_date: ymd,
    harvest_date: ymd,
    selected_harvests: lockedList,
    harvest_dates: lockedList,
    lock_order_harvest: true,
  };
}

/**
 * Merge API/order row with optional live field metadata without letting field
 * harvest schedule overwrite the order's season.
 */
export function mergeOrderWithFieldSafe(order, linkedField = {}) {
  const locked = lockOrderHarvestDisplay(order);
  const fieldHarvestDates =
    order.field_harvest_dates ??
    linkedField.harvest_dates ??
    linkedField.harvestDates ??
    null;
  return {
    ...locked,
    field_harvest_dates: fieldHarvestDates,
    current_field_harvest_dates: fieldHarvestDates,
  };
}
