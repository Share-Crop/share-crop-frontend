import { getOrderHarvestYmd } from './orderHarvestGate';

/**
 * Past-season / closed orders must not inherit a relisted field's new harvest schedule.
 * Active/pending = current season stake on that field.
 */
export function isPastSeasonOrder(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  if (status === 'completed' || status === 'shipped' || status === 'cancelled') {
    return true;
  }
  const orderYmd = getOrderHarvestYmd(order);
  if (!orderYmd) return false;

  const rawFieldDates =
    order?.field_harvest_dates ??
    order?.fieldHarvestDates ??
    order?.current_field_harvest_dates ??
    null;
  let fieldDates = rawFieldDates;
  if (typeof fieldDates === 'string') {
    try {
      fieldDates = JSON.parse(fieldDates);
    } catch {
      fieldDates = [];
    }
  }
  if (!Array.isArray(fieldDates) || fieldDates.length === 0) return false;

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const upcoming = fieldDates
    .map((h) => {
      const d = typeof h === 'object' && h != null ? h.date : h;
      const s = String(d || '').trim().slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    })
    .filter((s) => s && s >= todayYmd)
    .sort();

  if (!upcoming.length) return false;
  // Order harvest is strictly before the field's next upcoming season date → last season.
  return orderYmd < upcoming[0];
}

export function pastSeasonOrderLabel(order) {
  const status = String(order?.status || '').trim().toLowerCase();
  if (status === 'shipped') return 'Last season · Shipped';
  if (status === 'completed') return 'Last season · Completed';
  if (status === 'cancelled') return 'Last season · Cancelled';
  return 'Last season';
}
