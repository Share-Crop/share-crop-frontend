/**
 * True when this field has a prior harvest on record and is growing again
 * (typically after "List again" for a new season).
 */
export function isFieldRelisted(field) {
  if (!field) return false;
  const qty = parseFloat(field.last_season_yield);
  if (!(Number.isFinite(qty) && qty > 0)) return false;
  const status = String(field.operational_status || 'growing').toLowerCase();
  return status === 'growing';
}
