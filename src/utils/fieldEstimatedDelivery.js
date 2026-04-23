/**
 * Farmer-set shipping lead: whole days from harvest until goods are typically delivered.
 * Matches backend `fields.estimated_delivery_days`.
 */
export function getEstimatedDeliveryLeadDays(entity, fallbackWhenUnset = null) {
  if (!entity || typeof entity !== 'object') return fallbackWhenUnset;
  const raw = entity.estimated_delivery_days ?? entity.estimatedDeliveryDays ?? null;
  if (raw == null || raw === '') return fallbackWhenUnset;
  const n = parseInt(String(raw).trim(), 10);
  if (Number.isNaN(n) || n < 1) return fallbackWhenUnset;
  return Math.min(n, 366);
}

/** Short label, e.g. "~5 days after harvest" */
export function formatShippingLeadAfterHarvest(days) {
  if (days == null || days < 1) return null;
  const n = Math.min(Math.floor(Number(days)), 366);
  if (n < 1) return null;
  return `~${n} day${n === 1 ? '' : 's'} after harvest`;
}
