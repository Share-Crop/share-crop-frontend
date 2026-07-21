/**
 * Buyer map stake / progress bar: only these order statuses count as
 * "I currently rent this field" (aligned with fields occupancy API).
 * Completed / shipped / cancelled past-season orders must NOT block repurchase
 * after a farmer lists the field again.
 */
export const BUYER_ACTIVE_STAKE_STATUSES = ['pending', 'active', 'confirmed'];

export function isActiveBuyerOrderStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return BUYER_ACTIVE_STAKE_STATUSES.includes(s);
}
