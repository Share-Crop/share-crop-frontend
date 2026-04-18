/**
 * First usable harvest calendar day on the order (YYYY-MM-DD), or null.
 */
export function getOrderHarvestYmd(order) {
  if (!order) return null;
  const raw =
    order.order_selected_harvest_date ??
    order.delivery_date ??
    order.selected_harvest_date ??
    order.harvest_date ??
    null;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    const m = String(raw).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return null;
}

/** Shipped / Completed allowed only when harvest day exists and today (UTC) is on or after that day. */
export function canSelectShippedOrCompletedStatus(order) {
  const h = getOrderHarvestYmd(order);
  if (!h) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today >= h;
}
