import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY = {
  newUserRegistrations: 0,
  pendingFarmerApprovals: 0,
  newComplaints: 0,
  pendingCategoryRequests: 0,
  pendingRedemptions: 0,
  totalAttention: 0,
};

/**
 * Poll admin attention counts for sidebar/header badges.
 */
export default function useAdminPendingCounts({ enabled = true, intervalMs = 45000 } = {}) {
  const [counts, setCounts] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get('/api/admin/notifications/overview');
      const data = res.data || {};
      setCounts({
        newUserRegistrations: Number(data.newUserRegistrations) || 0,
        pendingFarmerApprovals: Number(data.pendingFarmerApprovals) || 0,
        newComplaints: Number(data.newComplaints) || 0,
        pendingCategoryRequests: Number(data.pendingCategoryRequests) || 0,
        pendingRedemptions: Number(data.pendingRedemptions) || 0,
        totalAttention: Number(data.totalAttention) || 0,
      });
    } catch (err) {
      console.warn('[admin pending counts]', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const id = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, intervalMs, refresh]);

  return { counts, loading, refresh };
}
